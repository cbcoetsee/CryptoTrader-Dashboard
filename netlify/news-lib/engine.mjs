// One poll cycle: refresh calendar + news, update outcomes, move expired calls to history.
// `io` = { json(url), text(url), post(url, body, headers) } so it can be tested offline.
import {
  MIN, RISK_WINDOW, HISTORY_DAYS, FF_URL, FF_REFRESH, RSS_FEEDS,
  parseFF, parseCryptoEvents, parseRSS, newsSignal, keywordSignal, pctMoves, combine, matchActual, sast,
} from "../../news/core.mjs";

export function emptyState() {
  return { events: [], breaking: [], outcomes: [], history: [], calendarAt: 0, errors: {}, lastPoll: 0 };
}

const klineUrl = (sym, fromMs, toMs) =>
  `https://contract.mexc.com/api/v1/contract/kline/${sym}?interval=Min1&start=${Math.floor(fromMs / 1000)}&end=${Math.floor(toMs / 1000)}`;

async function moves(io, sym, atMs, mins) {
  const last = Math.max(...mins);
  const r = await io.json(klineUrl(sym, atMs - 2 * MIN, atMs + (last + 2) * MIN));
  return pctMoves(r && r.data, atMs, mins);
}

export async function poll(state, now, io, env = {}) {
  const s = state || emptyState();
  s.errors = {};

  // 1. Economic calendar (Forex Factory weekly feed, free) + your scheduled crypto events
  if (now - (s.calendarAt || 0) > FF_REFRESH) {
    try {
      const macro = parseFF(await io.json(FF_URL));
      if (macro.length) {
        const keep = new Map(s.events.filter(e => e.kind === "macro").map(e => [e.id, e]));
        s.events = s.events.filter(e => e.kind !== "macro").concat(macro.map(e => ({ ...e, ...(keep.get(e.id)?.actual ? { actual: keep.get(e.id).actual } : {}) })));
        s.calendarAt = now;
      }
    } catch (e) { s.errors.calendar = String(e.message || e); }
  }
  // Your scheduled crypto events: crypto-events.json is built into the poller at deploy time
  // (no web request, so it also works on a password-protected site). Edit + commit → Netlify redeploys.
  if (env.CRYPTO_EVENTS) {
    try {
      const crypto = parseCryptoEvents(env.CRYPTO_EVENTS);
      s.events = s.events.filter(e => e.kind !== "crypto").concat(crypto);
    } catch (e) { s.errors.cryptoEvents = String(e.message || e); }
  }
  s.events = s.events.filter(e => e.at > now - 26 * 60 * MIN).sort((a, b) => a.at - b.at);

  // 2. Breaking crypto news (RSS)
  for (const f of RSS_FEEDS) {
    try {
      for (const it of parseRSS(await io.text(f.url), f.src)) {
        if (it.at < now - RISK_WINDOW || it.at > now + 5 * MIN) continue;
        if (!s.breaking.some(b => b.id === it.id)) s.breaking.push(it);
      }
    } catch (e) { s.errors["rss_" + f.src] = String(e.message || e); }
  }
  s.breaking = s.breaking.filter(b => b.at > now - RISK_WINDOW).sort((a, b) => b.at - a.at).slice(0, 20);

  // 3. Actual values (optional: Finnhub, if your key has economic-calendar access)
  const needActual = s.events.filter(e => e.kind === "macro" && e.forecast && e.at <= now && e.at > now - 30 * MIN && !e.actual);
  if (env.FINNHUB_API_KEY && needActual.length) {
    try {
      const d = new Date(now).toISOString().slice(0, 10);
      const r = await io.json(`https://finnhub.io/api/v1/calendar/economic?from=${d}&to=${d}&token=${env.FINNHUB_API_KEY}`);
      if (r && r.error) throw new Error(r.error);
      for (const e of needActual) { const a = matchActual(e, r && r.economicCalendar); if (a) e.actual = a; }
    } catch (e) { s.errors.actuals = String(e.message || e); }
  }

  // 4. Create outcome cards for released events and breaking news
  const haveIds = new Set(s.outcomes.map(o => o.id).concat(s.history.map(h => h.id)));
  for (const e of s.events) {
    if (e.at > now || e.at < now - RISK_WINDOW || haveIds.has(e.id)) continue;
    if (e.kind === "macro") s.outcomes.push({ id: e.id, kind: "macro", name: e.name, cur: e.cur, at: e.at, forecast: e.forecast, previous: e.previous, actual: e.actual || "", sym: "BTC_USDT" });
    else s.outcomes.push({ id: e.id, kind: "crypto", name: e.name, coin: e.coin, at: e.at, sym: e.coin + "_USDT" });
  }
  for (const b of s.breaking) {
    if (haveIds.has(b.id) || s.outcomes.some(o => o.id === b.id)) continue;
    const coin = b.coins.find(c => c !== "BTC") || b.coins[0];
    s.outcomes.push({ id: b.id, kind: "break", name: b.title, link: b.link, src: b.src, coin, coins: b.coins, at: b.at, sym: coin + "_USDT" });
  }

  // 5. Update each outcome: actual → news signal, 5m/15m price, LLM note
  for (const o of s.outcomes) {
    if (o.kind === "macro") {
      const ev = s.events.find(e => e.id === o.id);
      if (ev && ev.actual && !o.actual) o.actual = ev.actual;
      o.news = newsSignal(o.name, o.actual, o.forecast);
    } else if (o.kind === "break") {
      o.news = keywordSignal(o.name);
    } else o.news = null;
    const need = [];
    if (o.p5 == null && now >= o.at + 6 * MIN) need.push(5);
    if (o.p15 == null && now >= o.at + 16 * MIN) need.push(15);
    if (need.length) {
      try { const m = await moves(io, o.sym, o.at, need); if (m[5] != null) o.p5 = m[5]; if (m[15] != null) o.p15 = m[15]; }
      catch (e) { s.errors["price_" + o.sym] = String(e.message || e); }
    }
    Object.assign(o, combine(o.news, o.p5, o.p15));
    if (env.ANTHROPIC_API_KEY && !o.llm && o.news && o.news.dir !== "flat" && o.p15 != null) {
      try { o.llm = await llmNote(io, env, o); } catch (e) { s.errors.llm = String(e.message || e); o.llm = { note: "" }; }
    }
  }

  // 6. Expire after the 2-hour window → History with the 1-hour outcome
  const still = [];
  for (const o of s.outcomes) {
    if (now < o.at + RISK_WINDOW) { still.push(o); continue; }
    let h1 = null;
    try { h1 = (await moves(io, o.sym, o.at, [60]))[60] ?? null; } catch (e) { /* keep null */ }
    // Only score calls that had a news read AND price agreed (price-only, amber and flat calls are not scored)
    const dir = (o.cls === "bull" || o.cls === "bear") && o.news && o.news.dir === o.cls ? o.cls : null;
    const held = dir && h1 != null ? (dir === "bull" ? h1 > 0 : h1 < 0) : null;
    s.history.unshift({ id: o.id, name: o.name, kind: o.kind, cur: o.cur, coin: o.coin, at: o.at, call: o.call, cls: o.cls, sym: o.sym, h1, held });
  }
  s.outcomes = still.sort((a, b) => b.at - a.at);
  s.history = s.history.filter(h => h.at > now - HISTORY_DAYS * 24 * 60 * MIN).slice(0, 300);
  s.lastPoll = now;
  return s;
}

// §7C optional LLM synthesis (Claude). Short rationale per signal + one line on disagreements.
async function llmNote(io, env, o) {
  const p = `You help a crypto futures scalper read a news release. Event: ${o.name}${o.actual ? ` (actual ${o.actual} vs forecast ${o.forecast}, previous ${o.previous})` : ""}.
News signal: ${o.news.dir} (${o.news.why}). Price reaction of ${o.sym}: 5m ${o.p5}% · 15m ${o.p15}%.
Reply in JSON only: {"news":"<=12 words why the news reads this way","price":"<=12 words on the price reaction","note":"one sentence: what it means if they disagree, else empty"}`;
  const r = await io.post("https://api.anthropic.com/v1/messages",
    { model: env.ANTHROPIC_MODEL || "claude-sonnet-4-5", max_tokens: 200, messages: [{ role: "user", content: p }] },
    { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" });
  const txt = r && r.content && r.content[0] && r.content[0].text || "";
  const j = JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1));
  return { news: String(j.news || ""), price: String(j.price || ""), note: String(j.note || "") };
}

// What the browser receives (§3/§4/§8). Times are sent as ms plus ready-made SAST strings.
export function publicView(s, now) {
  const upcoming = s.events.filter(e => e.at > now && e.at <= now + 24 * 60 * MIN).map(e => ({ ...e, sast: sast(e.at) }));
  return {
    serverTime: now, lastPoll: s.lastPoll, errors: s.errors,
    upcoming, breaking: s.breaking.map(b => ({ ...b, sast: sast(b.at) })),
    outcomes: s.outcomes.map(o => ({ ...o, sast: sast(o.at), riskLeftMin: Math.max(0, Math.ceil((o.at + RISK_WINDOW - now) / MIN)) })),
    history: s.history,
  };
}
