/* 35A News Alert widget v1.1 · bundled from news/news-widget.js + news/core.mjs · edit the sources, not this file */
(() => {
  // ../../../home/claude/news-build/news/core.mjs
  var MIN = 60 * 1e3;
  var RISK_WINDOW = 120 * MIN;
  var PRICE_FLAT = 0.15;
  var FF_REFRESH = 30 * MIN;
  function sast(ms) {
    return new Date(ms).toLocaleTimeString("en-GB", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" });
  }
  function sastDay(ms) {
    return new Date(ms).toLocaleDateString("en-GB", { timeZone: "Africa/Johannesburg", weekday: "short", day: "2-digit", month: "short" });
  }
  function parseNum(v) {
    if (v === null || v === void 0) return null;
    if (typeof v === "number") return v;
    const m = String(v).replace(/,/g, "").trim().match(/^([+-]?\d*\.?\d+)\s*([KMBT%]?)/i);
    if (!m) return null;
    const mult = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[m[2].toUpperCase()] || 1;
    return parseFloat(m[1]) * mult;
  }
  function eventBias(name) {
    const n = name.toLowerCase();
    if (/unemployment|jobless|claims/.test(n)) return "dovish";
    if (/cpi|ppi|pce|inflation|price index|earnings|wage|non-farm|nfp|employment change|payroll|adp|jolts|job openings|retail sales|gdp|pmi|ism|confidence|sentiment|rate decision|interest rate|refinancing|bank rate|funds rate|cash rate/.test(n)) return "hawkish";
    return null;
  }
  function newsSignal(name, actual, forecast) {
    const a = parseNum(actual), f = parseNum(forecast), bias = eventBias(name);
    if (a === null || f === null || !bias) return null;
    if (a === f) return { dir: "flat", why: `in line with forecast (${actual} vs ${forecast})` };
    const higher = a > f;
    const bull = bias === "hawkish" ? !higher : higher;
    const word = bias === "hawkish" ? higher ? "hotter than forecast \u2192 fewer cuts" : "cooler than forecast \u2192 more cuts" : higher ? "weaker than forecast \u2192 more cuts" : "stronger than forecast \u2192 fewer cuts";
    return { dir: bull ? "bull" : "bear", why: word };
  }
  function priceDir(pct2) {
    if (pct2 === null || pct2 === void 0) return null;
    if (Math.abs(pct2) < PRICE_FLAT) return "flat";
    return pct2 > 0 ? "bull" : "bear";
  }
  function combine(news, p5, p15) {
    const pd = priceDir(p15 ?? p5);
    const n = news ? news.dir : null;
    const word = (d) => d === "bull" ? "BULLISH" : d === "bear" ? "BEARISH" : "FLAT";
    if (pd === null) {
      if (n && n !== "flat") return { cls: "pend", call: "INITIAL: " + word(n), conf: 1 };
      return { cls: "pend", call: "WAITING FOR PRICE", conf: 0 };
    }
    if (!n || n === "flat") {
      if (pd === "flat") return { cls: "flat", call: "FLAT", conf: 0 };
      return { cls: pd, call: "PRICE: " + word(pd), conf: 1 };
    }
    if (pd === "flat") return { cls: n, call: word(n) + " (unconfirmed)", conf: 1 };
    if (pd === n) {
      const strong = p15 !== null && p15 !== void 0 && Math.abs(p15) >= 0.5 && priceDir(p5) === n;
      return { cls: n, call: word(n), conf: strong ? 3 : 2 };
    }
    return { cls: "mixed", call: "NEWS \u2260 PRICE", conf: 1 };
  }

  // ../../../home/claude/news-build/news/news-widget.js
  var OPT = window.NEWS_WIDGET || {};
  var DEFAULT_COINS = ["ETH", "AVAX", "ADA", "SOL", "ZEC", "BNB", "DOGE", "XLM", "LINK", "HYPE"];
  var FLAG = { USD: "\u{1F1FA}\u{1F1F8} USD", EUR: "\u{1F1EA}\u{1F1FA} EUR", GBP: "\u{1F1EC}\u{1F1E7} GBP" };
  var POLL_MS = 60 * 1e3;
  var demo = OPT.demo || new URLSearchParams(location.search).has("demo");
  var fileMode = location.protocol === "file:";
  var ls = {
    get(k, d) {
      try {
        const v = localStorage.getItem("nw." + k);
        return v === null ? d : JSON.parse(v);
      } catch {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem("nw." + k, JSON.stringify(v));
      } catch {
      }
    }
  };
  function dashboardTokens() {
    const clean = (list) => {
      const set = new Set(list.map((t) => String(t || "").trim().toUpperCase()).filter((t) => /^[A-Z0-9]{2,10}$/.test(t)));
      return [...set].filter((t) => !(t.endsWith("US") && set.has(t.slice(0, -2))));
    };
    try {
      const raw = localStorage.getItem("barReplayDashboard.workingState.v1");
      const recs = raw && JSON.parse(raw).dataset?.records;
      if (Array.isArray(recs) && recs.length) return clean(recs.map((r) => r.TOKEN ?? r.values?.TOKEN ?? r.raw?.TOKEN));
    } catch {
    }
    try {
      const snap = JSON.parse(document.getElementById("embedded-snapshot")?.textContent || "null");
      const col = snap?.meta?.columns?.find((c) => c.header === "TOKEN");
      if (col?.distinctValues?.length) return clean(col.distinctValues);
    } catch {
    }
    return [];
  }
  var LOG_COINS = OPT.embed ? dashboardTokens() : [];
  var ALL_COINS = LOG_COINS.length ? LOG_COINS : DEFAULT_COINS;
  var known = new Set(ls.get("knownCoins", []));
  var active = new Set(ls.get("coins", ALL_COINS));
  for (const c of ALL_COINS) if (!known.has(c)) active.add(c);
  ls.set("knownCoins", [.../* @__PURE__ */ new Set([...known, ...ALL_COINS])]);
  ls.set("coins", [...active]);
  var theme = ls.get("theme", "auto");
  var data = null;
  var lastKey = "";
  var $ = (sel, root = document) => root.querySelector(sel);
  var esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  var fmt = (ms) => {
    ms = Math.max(0, ms);
    const m = Math.floor(ms / MIN), s = Math.floor(ms % MIN / 1e3);
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  };
  var relevant = (o) => o.kind === "macro" || (o.coins ? o.coins.some((c) => active.has(c)) : active.has(o.coin));
  var stripEl = $("#news-strip");
  var panelEl = $("#news-panel");
  var apiBase = () => (fileMode ? ls.get("apiBase", "") : "").replace(/\/$/, "");
  if (!stripEl) {
    stripEl = document.createElement("div");
    document.body.prepend(stripEl);
  }
  stripEl.classList.add("nw");
  if (OPT.embed) stripEl.classList.add("nw-dash");
  stripEl.innerHTML = `<div class="nw-strip">
  <div class="nw-lab"><span class="nw-dot"></span>NEXT 60 MIN</div>
  <div class="nw-track"><div class="nw-move"></div></div>
  <button class="nw-more" type="button">+0 more \u25BE<div class="nw-drop"></div></button>
  <button class="nw-btn nw-theme" type="button" title="Theme">\u25D0</button></div>`;
  if (panelEl) {
    panelEl.classList.add("nw");
    if (OPT.embed) panelEl.classList.add("nw-dash");
    panelEl.innerHTML = `<div class="nw-grid"><div>
    <div class="nw-card"><div class="nw-h">Outcome Panel <span class="nw-small nw-status"></span></div><div class="nw-outcomes"></div></div>
    <div class="nw-card"><details><summary>History: expired calls (did the call hold?)</summary>
      <table><thead><tr><th>When</th><th>Event</th><th>Call</th><th>1h later</th><th>Held?</th></tr></thead><tbody class="nw-hist"></tbody></table>
      <div class="nw-small nw-hit" style="margin-top:6px"></div></details></div>
  </div><div>
    <div class="nw-card"><div class="nw-h">Active coins <span class="nw-small">from 35A log</span></div><div class="nw-chips"></div>
      <form class="nw-add"><input maxlength="10" placeholder="Add coin, e.g. XRP"><button class="nw-btn" type="submit">Add</button></form>
      <div class="nw-small" style="margin-top:8px">Macro events show for all coins. Crypto news only for ticked coins.</div></div>
    <div class="nw-card"><div class="nw-h">High-impact calendar \xB7 next 24h</div><table><tbody class="nw-cal"></tbody></table></div>
  </div></div>`;
  }
  function applyTheme() {
    if (OPT.embed) {
      $(".nw-theme", stripEl).style.display = "none";
      for (const el of [stripEl, panelEl]) if (el) el.dataset.theme = "dark";
      return;
    }
    const t = theme === "auto" ? matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark" : theme;
    for (const el of [stripEl, panelEl]) if (el) el.dataset.theme = t;
    $(".nw-theme", stripEl).textContent = theme === "auto" ? "\u25D0 Auto" : theme === "light" ? "\u2600 Light" : "\u263E Dark";
  }
  $(".nw-theme", stripEl).onclick = () => {
    theme = theme === "auto" ? "dark" : theme === "dark" ? "light" : "auto";
    ls.set("theme", theme);
    applyTheme();
  };
  matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", applyTheme);
  $(".nw-more", stripEl).onclick = (e) => {
    if (!e.target.closest(".nw-drop")) $(".nw-drop", stripEl).classList.toggle("on");
  };
  applyTheme();
  function renderStrip() {
    if (!data) return;
    const now = Date.now();
    const v = data.upcoming.filter((e) => e.at > now && e.at - now <= 60 * MIN && relevant(e)).sort((a, b) => a.at - b.at);
    const br = data.breaking.filter((b) => b.at > now - 60 * MIN && relevant(b));
    const show = v.slice(0, 3), rest = v.slice(3);
    const key = show.map((e) => e.id).join() + "|" + rest.map((e) => e.id).join() + "|" + br.map((b) => b.id).join();
    if (key !== lastKey) {
      lastKey = key;
      const item = (e) => `<span class="nw-item"><span class="nw-tag ${e.kind === "macro" ? "nw-t-macro" : "nw-t-crypto"}">${e.kind === "macro" ? "MACRO" : "CRYPTO"}</span>
      <b>${esc(e.name)}</b><span class="nw-small">${e.kind === "macro" ? FLAG[e.cur] || e.cur : esc(e.coin)}</span>
      <span class="nw-cd" data-at="${e.at}"></span><span class="nw-small">${sast(e.at)} SAST</span></span>`;
      const bItem = (b) => `<span class="nw-item"><span class="nw-tag nw-t-break">BREAKING</span><a href="${esc(b.link)}" target="_blank" rel="noopener"><b>${esc(b.title)}</b></a><span class="nw-small">${esc(b.coins.join(" "))} \xB7 ${sast(b.at)}</span></span>`;
      const one = br.map(bItem).join("") + show.map(item).join('<span class="nw-small">\u2022</span>');
      $(".nw-move", stripEl).innerHTML = one ? one + '<span style="width:60px"></span>' + one + '<span style="width:60px"></span>' : '<span class="nw-empty">No high-impact UK/US/EU events in the next 60 min</span>';
      $(".nw-move", stripEl).style.animation = one ? "" : "none";
      const more = $(".nw-more", stripEl);
      more.style.display = rest.length ? "" : "none";
      more.firstChild.textContent = `+${rest.length} more \u25BE`;
      $(".nw-drop", stripEl).innerHTML = rest.map((e) => `<div>${e.kind === "macro" ? "\u{1F535}" : "\u{1F7E3}"} <b>${esc(e.name)}</b> \xB7 ${sast(e.at)} SAST \xB7 in <span class="nw-cd" data-at="${e.at}"></span></div>`).join("");
    }
    stripEl.querySelectorAll(".nw-cd").forEach((el) => {
      const d = +el.dataset.at - now;
      el.textContent = fmt(d);
      el.style.color = d < 10 * MIN ? "var(--nw-red)" : "";
    });
  }
  var dirSpan = (d) => d === "bull" ? '<span class="nw-g">Bullish</span>' : d === "bear" ? '<span class="nw-r">Bearish</span>' : "Flat";
  var pct = (p) => p == null ? "\u2026" : (p > 0 ? "+" : "") + p.toFixed(2) + "%";
  function renderPanel() {
    if (!panelEl || !data) return;
    const now = Date.now();
    const out = data.outcomes.filter(relevant).map((o) => {
      let x = o;
      const manual = ls.get("actual." + o.id, "");
      if (o.kind === "macro" && !o.actual && manual) {
        const news = newsSignal(o.name, manual, o.forecast);
        x = { ...o, actual: manual, news, ...combine(news, o.p5, o.p15) };
      }
      const left = Math.max(0, Math.ceil((x.at + 120 * MIN - now) / MIN));
      const title = x.kind === "macro" ? `${FLAG[x.cur] || x.cur} ${esc(x.name)}` : x.kind === "break" ? `<a href="${esc(x.link)}" target="_blank" rel="noopener">${esc(x.coin)} \xB7 BREAKING \xB7 ${esc(x.name)}</a>` : `${esc(x.coin)} \xB7 ${esc(x.name)}`;
      const val = x.kind === "macro" ? x.actual ? `${esc(x.actual)} vs ${esc(x.forecast || "\u2013")} exp` : x.forecast || x.previous ? `forecast ${esc(x.forecast || "\u2013")} \xB7 prev ${esc(x.previous || "\u2013")}` : "" : esc(x.src || "");
      const newsTxt = x.news ? `${dirSpan(x.news.dir)} (${esc(x.llm?.news || x.news.why)})` : x.kind === "macro" ? x.forecast ? "waiting for actual" : "no number (speech / statement)" : "no clear headline signal";
      const priceTxt = x.p5 == null && x.p15 == null ? "waiting for 5m / 15m" : `${x.p15 != null ? dirSpan(x.p15 >= 0.15 ? "bull" : x.p15 <= -0.15 ? "bear" : "flat") : ""} (${esc(x.sym.replace("_", ""))} 5m ${pct(x.p5)} \xB7 15m ${pct(x.p15)})`;
      const needActual = x.kind === "macro" && !o.actual && !!o.forecast;
      return `<div class="nw-entry ${x.cls}"><div class="nw-e1"><b>${title} <span class="nw-small">\xB7 ${val}</span></b>
      <span><span class="nw-conf" title="confidence">${"\u25CF".repeat(x.conf || 0)}${"\u25CB".repeat(3 - (x.conf || 0))}</span> <span class="nw-call nw-c-${x.cls}">${esc(x.call)}</span></span></div>
      <div class="nw-e2">News: ${newsTxt} \xB7 Price: ${priceTxt} \xB7 released ${sast(x.at)}</div>
      ${x.llm?.note ? `<div class="nw-note">${esc(x.llm.note)}</div>` : ""}
      ${needActual ? `<div class="nw-act">Actual: <input data-id="${x.id}" value="${esc(manual)}" placeholder="e.g. 3.4%"> <span class="nw-small">type it if it doesn't fill in automatically</span></div>` : ""}
      ${left > 0 ? `<div class="nw-risk">\u26A0 Elevated entry risk: reaction still settling, ${left} min left</div>` : ""}</div>`;
    });
    $(".nw-outcomes", panelEl).innerHTML = out.join("") || '<div class="nw-small">No released high-impact events in the last 2 hours.</div>';
    panelEl.querySelectorAll(".nw-act input").forEach((inp) => inp.onchange = () => {
      ls.set("actual." + inp.dataset.id, inp.value.trim());
      renderPanel();
    });
    const hist = data.history.filter(relevant);
    $(".nw-hist", panelEl).innerHTML = hist.slice(0, 50).map((h) => `<tr><td>${sastDay(h.at)} ${sast(h.at)}</td><td>${h.kind === "macro" ? FLAG[h.cur] || "" : esc(h.coin)} ${esc(h.name)}</td>
    <td>${esc(h.call)}</td><td>${pct(h.h1)} <span class="nw-small">${esc((h.sym || "").replace("_", ""))}</span></td>
    <td>${h.held === true ? '<span class="nw-g">\u2713 held</span>' : h.held === false ? '<span class="nw-r">\u2717 failed</span>' : '<span class="nw-small">n/a</span>'}</td></tr>`).join("") || '<tr><td colspan="5" class="nw-small">Nothing yet. Calls move here 2 hours after release.</td></tr>';
    const scored = hist.filter((h) => h.held !== null && h.held !== void 0);
    $(".nw-hit", panelEl).innerHTML = scored.length ? `Hit rate last 30 days: <b>${scored.filter((h) => h.held).length} / ${scored.length} (${Math.round(100 * scored.filter((h) => h.held).length / scored.length)}%)</b> \xB7 amber, flat and price-only calls not counted` : "";
    const coins = [.../* @__PURE__ */ new Set([...ALL_COINS, ...ls.get("coins", ALL_COINS)])];
    $(".nw-chips", panelEl).innerHTML = coins.map((c) => `<button type="button" class="nw-chip ${active.has(c) ? "on" : ""}" data-c="${c}">${c}</button>`).join("");
    $(".nw-cal", panelEl).innerHTML = data.upcoming.map((e) => `<tr style="${relevant(e) ? "" : "opacity:.35"}"><td>${sastDay(e.at)} ${sast(e.at)}</td><td>${esc(e.name)}</td><td class="nw-small">${e.kind === "macro" ? FLAG[e.cur] || e.cur : esc(e.coin)}</td></tr>`).join("") || '<tr><td class="nw-small">No high-impact UK/US/EU events in the next 24 hours.</td></tr>';
    const cnt = document.getElementById(OPT.countId || "newsCount");
    if (cnt) {
      const n = data.outcomes.filter(relevant).filter((o) => o.at + 120 * MIN > now).length;
      cnt.textContent = n;
      cnt.classList.toggle("nw-hot", n > 0);
    }
    if (fileMode && !demo) {
      const box = panelEl.querySelector(".nw-base") || panelEl.querySelector(".nw-outcomes").insertAdjacentElement("beforebegin", Object.assign(document.createElement("form"), { className: "nw-base nw-add" }));
      if (!box.dataset.ready) {
        box.dataset.ready = 1;
        box.innerHTML = `<input placeholder="https://your-site.netlify.app" value="${esc(ls.get("apiBase", ""))}" style="text-transform:none"><button class="nw-btn" type="submit">Use site</button>`;
        box.onsubmit = (ev) => {
          ev.preventDefault();
          ls.set("apiBase", $("input", box).value.trim());
          load();
        };
      }
    }
    const errs = Object.keys(data.errors || {});
    const age = Math.round((now - data.lastPoll) / MIN);
    $(".nw-status", panelEl).innerHTML = (demo ? "DEMO DATA \xB7 " : "") + (data.lastPoll ? `updated ${age <= 0 ? "now" : age + " min ago"}` : "waiting for first update") + (errs.length ? ` \xB7 <span class="nw-warn" title="${esc(JSON.stringify(data.errors))}">\u26A0 ${errs.length} source issue${errs.length > 1 ? "s" : ""}</span>` : "");
  }
  if (panelEl) {
    panelEl.addEventListener("click", (e) => {
      const b = e.target.closest(".nw-chip");
      if (!b) return;
      const c = b.dataset.c;
      active.has(c) ? active.delete(c) : active.add(c);
      ls.set("coins", [...active]);
      lastKey = "";
      renderPanel();
      renderStrip();
    });
    $(".nw-add", panelEl).onsubmit = (e) => {
      e.preventDefault();
      const inp = $("input", e.target);
      const c = inp.value.trim().toUpperCase().replace(/USDT$/, "");
      if (c) {
        active.add(c);
        ls.set("coins", [...active]);
        inp.value = "";
        lastKey = "";
        renderPanel();
        renderStrip();
      }
    };
  }
  async function load() {
    if (document.hidden && data) return;
    try {
      if (!demo && fileMode && !apiBase()) throw new Error("nobase");
      data = demo ? demoData() : await (await fetch(apiBase() + "/api/news", { cache: "no-store" })).json();
    } catch (e) {
      data = data || { upcoming: [], breaking: [], outcomes: [], history: [], errors: { api: e.message === "nobase" ? "Opened from a file: set your Netlify site address below" : "News service not reachable" }, lastPoll: 0, needBase: e.message === "nobase" };
    }
    lastKey = "";
    renderStrip();
    renderPanel();
  }
  load();
  setInterval(load, POLL_MS);
  setInterval(renderStrip, 1e3);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) load();
  });
  function demoData() {
    const n = Date.now();
    const ev = (name, cur, m, f, p) => ({ id: "d" + name, kind: "macro", name, cur, at: n + m * MIN, forecast: f, previous: p });
    const o = (x) => ({ ...x, ...combine(x.news, x.p5, x.p15) });
    return {
      lastPoll: n - MIN,
      errors: {},
      upcoming: [
        ev("Core CPI m/m", "USD", 9, "0.3%", "0.2%"),
        ev("Main Refinancing Rate", "EUR", 24, "2.15%", "2.15%"),
        { id: "dsol", kind: "crypto", name: "SEC decision: SOL spot ETF", coin: "SOL", at: n + 37 * MIN },
        ev("BOE Gov Bailey Speaks", "GBP", 48, "", ""),
        ev("Crude Oil Inventories", "USD", 56, "-1.2M", "2.1M"),
        ev("Unemployment Claims", "USD", 20 * 60, "231K", "229K")
      ],
      breaking: [{ id: "dzec", kind: "break", title: "MEXC to delist ZEC perpetual pairs", link: "#", at: n - 6 * MIN, src: "Demo", coins: ["ZEC"] }],
      outcomes: [
        o({ id: "o1", kind: "macro", name: "CPI y/y", cur: "GBP", at: n - 38 * MIN, forecast: "2.8%", previous: "2.9%", actual: "3.1%", sym: "BTC_USDT", news: newsSignal("CPI y/y", "3.1%", "2.8%"), p5: 0.62, p15: 1.08, llm: { note: "Price may be pricing in something beyond rates, or the reaction hasn't played out yet." } }),
        o({ id: "o2", kind: "macro", name: "Non-Farm Employment Change", cur: "USD", at: n - 73 * MIN, forecast: "140K", previous: "22K", actual: "254K", sym: "BTC_USDT", news: newsSignal("Non-Farm Employment Change", "254K", "140K"), p5: -0.81, p15: -1.42 }),
        o({ id: "o3", kind: "macro", name: "Unemployment Claims", cur: "USD", at: n - 3 * MIN, forecast: "230K", previous: "228K", actual: "262K", sym: "BTC_USDT", news: newsSignal("Unemployment Claims", "262K", "230K"), p5: null, p15: null }),
        o({ id: "o4", kind: "macro", name: "Flash Manufacturing PMI", cur: "EUR", at: n - 9 * MIN, forecast: "49.8", previous: "49.5", actual: "", sym: "BTC_USDT", news: null, p5: 0.05, p15: null })
      ],
      history: [
        { id: "h1", kind: "macro", name: "ZEW Economic Sentiment", cur: "EUR", at: n - 5 * 60 * MIN, call: "BULLISH", cls: "bull", sym: "BTC_USDT", h1: 0.9, held: true },
        { id: "h2", kind: "macro", name: "FOMC Meeting Minutes", cur: "USD", at: n - 22 * 60 * MIN, call: "BEARISH", cls: "bear", sym: "BTC_USDT", h1: -1.6, held: true },
        { id: "h3", kind: "macro", name: "PPI m/m", cur: "USD", at: n - 46 * 60 * MIN, call: "BULLISH", cls: "bull", sym: "BTC_USDT", h1: -0.4, held: false },
        { id: "h4", kind: "macro", name: "ISM Services PMI", cur: "USD", at: n - 70 * 60 * MIN, call: "NEWS \u2260 PRICE", cls: "mixed", sym: "BTC_USDT", h1: 0.2, held: null }
      ]
    };
  }
})();
