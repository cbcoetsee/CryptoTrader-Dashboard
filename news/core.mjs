// News Alert core logic (shared by the scheduled poller and the state API).
// Pure functions where possible so they can be tested without network access.

export const COUNTRIES = ["USD", "EUR", "GBP"];          // UK / USA / EU
export const MIN = 60 * 1000;
export const RISK_WINDOW = 120 * MIN;                     // §8: 2-hour entry-risk window
export const HISTORY_DAYS = 30;
export const PRICE_FLAT = 0.15;                           // |% move| below this = flat
export const FF_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
export const FF_REFRESH = 30 * MIN;                       // be polite to the free feed
export const RSS_FEEDS = [
  { src: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { src: "Cointelegraph", url: "https://cointelegraph.com/rss" },
];

// Coins we can tag in crypto news (the client decides which ones are "active").
export const COIN_WORDS = {
  BTC: ["bitcoin", "btc"], ETH: ["ethereum", "ether", "eth"], SOL: ["solana", "sol"], ADA: ["cardano", "ada"],
  AVAX: ["avalanche", "avax"], ZEC: ["zcash", "zec"], BNB: ["bnb", "binance coin"], DOGE: ["dogecoin", "doge"],
  XLM: ["stellar", "xlm"], LINK: ["chainlink"], HYPE: ["hyperliquid", "hype token"], XRP: ["xrp", "ripple"],
};
// Only crypto headlines with one of these words count as "high impact" news.
export const IMPACT_WORDS = ["sec", "etf", "delist", "listing", "lists", "hack", "exploit", "lawsuit", "sues", "ban",
  "approv", "reject", "regulat", "court", "charges", "outage", "halt", "liquidat", "depeg", "bankrupt", "fed ", "tariff"];
const BEAR_WORDS = ["hack", "exploit", "delist", "lawsuit", "sues", "ban", "reject", "delay", "charges", "outage", "halt", "depeg", "bankrupt", "probe", "fraud", "drain"];
const BULL_WORDS = ["approv", "listing", "lists", "launch", "partnership", "adopt", "inflow", "record high", "greenlight", "wins"];

// ── helpers ────────────────────────────────────────────────────────────────
export function hashId(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
export function sast(ms) {
  return new Date(ms).toLocaleTimeString("en-GB", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" });
}
export function sastDay(ms) {
  return new Date(ms).toLocaleDateString("en-GB", { timeZone: "Africa/Johannesburg", weekday: "short", day: "2-digit", month: "short" });
}
// "3.4%", "254K", "-1.2B", "0.25%" → number in the same unit; null if not numeric
export function parseNum(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  const m = String(v).replace(/,/g, "").trim().match(/^([+-]?\d*\.?\d+)\s*([KMBT%]?)/i);
  if (!m) return null;
  const mult = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[m[2].toUpperCase()] || 1;
  return parseFloat(m[1]) * mult;
}

// ── §7A News signal (rule-based) ────────────────────────────────────────────
// "hawkish": a HIGHER number than forecast = less chance of rate cuts = BEARISH for crypto
// "dovish" : a HIGHER number than forecast = weaker economy / more cuts = BULLISH for crypto
export function eventBias(name) {
  const n = name.toLowerCase();
  if (/unemployment|jobless|claims/.test(n)) return "dovish";
  if (/cpi|ppi|pce|inflation|price index|earnings|wage|non-farm|nfp|employment change|payroll|adp|jolts|job openings|retail sales|gdp|pmi|ism|confidence|sentiment|rate decision|interest rate|refinancing|bank rate|funds rate|cash rate/.test(n)) return "hawkish";
  return null;
}
export function newsSignal(name, actual, forecast) {
  const a = parseNum(actual), f = parseNum(forecast), bias = eventBias(name);
  if (a === null || f === null || !bias) return null;
  if (a === f) return { dir: "flat", why: `in line with forecast (${actual} vs ${forecast})` };
  const higher = a > f;
  const bull = bias === "hawkish" ? !higher : higher;
  const word = bias === "hawkish" ? (higher ? "hotter than forecast → fewer cuts" : "cooler than forecast → more cuts")
                                  : (higher ? "weaker than forecast → more cuts" : "stronger than forecast → fewer cuts");
  return { dir: bull ? "bull" : "bear", why: word };
}
export function keywordSignal(title) {
  const t = title.toLowerCase();
  const bear = BEAR_WORDS.some(w => t.includes(w)), bull = BULL_WORDS.some(w => t.includes(w));
  if (bear && !bull) return { dir: "bear", why: "negative headline keywords" };
  if (bull && !bear) return { dir: "bull", why: "positive headline keywords" };
  return null;
}

// ── §7B Price signal ───────────────────────────────────────────────────────
export function priceDir(pct) {
  if (pct === null || pct === undefined) return null;
  if (Math.abs(pct) < PRICE_FLAT) return "flat";
  return pct > 0 ? "bull" : "bear";
}
// MEXC contract kline → % change from the open of the release minute to the close N minutes later
export function pctMoves(kline, atMs, minutesList) {
  if (!kline || !kline.time || !kline.time.length) return {};
  const t = kline.time.map(x => x * 1000);
  const i0 = t.findIndex(x => x >= atMs - 30e3);
  if (i0 < 0) return {};
  const base = kline.open[i0];
  const out = {};
  for (const m of minutesList) {
    const target = atMs + m * MIN;
    let j = -1;
    for (let k = i0; k < t.length; k++) if (t[k] + MIN <= target + 30e3) j = k;   // last candle that closed by target
    if (j >= i0 && t[j] + MIN >= target - 30e3) out[m] = +((kline.close[j] / base - 1) * 100).toFixed(2);
  }
  return out;
}

// ── combined call (§7, conflicts shown as NEWS ≠ PRICE) ─────────────────────
export function combine(news, p5, p15) {
  const pd = priceDir(p15 ?? p5);
  const n = news ? news.dir : null;
  const word = d => (d === "bull" ? "BULLISH" : d === "bear" ? "BEARISH" : "FLAT");
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
    const strong = p15 !== null && p15 !== undefined && Math.abs(p15) >= 0.5 && priceDir(p5) === n;
    return { cls: n, call: word(n), conf: strong ? 3 : 2 };
  }
  return { cls: "mixed", call: "NEWS ≠ PRICE", conf: 1 };
}

// ── parsers ────────────────────────────────────────────────────────────────
export function parseFF(json) {
  const list = Array.isArray(json) ? json : [];
  return list
    .filter(e => e && e.impact === "High" && COUNTRIES.includes(e.country))
    .map(e => {
      const at = Date.parse(e.date);
      return { id: "m" + hashId(e.title + e.country + e.date), kind: "macro", name: e.title, cur: e.country, at,
               forecast: e.forecast || "", previous: e.previous || "" };
    })
    .filter(e => Number.isFinite(e.at));
}
export function parseCryptoEvents(json) {
  const list = json && Array.isArray(json.events) ? json.events : [];
  return list.map(e => {
    const at = Date.parse(String(e.time).replace(" ", "T") + ":00+02:00");
    return { id: "c" + hashId(e.name + e.time), kind: "crypto", name: e.name, coin: String(e.coin || "").toUpperCase(), at };
  }).filter(e => Number.isFinite(e.at) && !/^example/i.test(e.name));
}
function decode(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
}
export function tagCoins(title) {
  const t = " " + title.toLowerCase().replace(/[^a-z0-9 ]/g, " ") + " ";
  return Object.keys(COIN_WORDS).filter(c => COIN_WORDS[c].some(w => t.includes(" " + w + " ")));
}
export function parseRSS(xml, src) {
  const items = [];
  const re = /<item[\s>][\s\S]*?<\/item>/g;
  for (const block of (xml || "").match(re) || []) {
    const get = tag => { const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)); return m ? decode(m[1]) : ""; };
    const title = get("title"), link = get("link"), at = Date.parse(get("pubDate"));
    if (!title || !Number.isFinite(at)) continue;
    const low = title.toLowerCase();
    if (!IMPACT_WORDS.some(w => low.includes(w))) continue;
    const coins = tagCoins(title);
    if (!coins.length) continue;
    items.push({ id: "b" + hashId(title), kind: "break", title, link, at, src, coins });
  }
  return items;
}
// Finnhub economic calendar → find the actual for one of our events (same currency, time within 3 min)
const CUR_TO_COUNTRY = { USD: ["US"], EUR: ["EU", "DE", "FR", "IT", "ES", "EA"], GBP: ["GB", "UK"] };
export function matchActual(ev, finnhubList) {
  const words = ev.name.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  let best = null, bestScore = 0;
  for (const f of finnhubList || []) {
    if (f.actual === null || f.actual === undefined || f.actual === "") continue;
    if (!(CUR_TO_COUNTRY[ev.cur] || []).includes(String(f.country).toUpperCase())) continue;
    const t = Date.parse(String(f.time).replace(" ", "T") + "Z");
    if (!Number.isFinite(t) || Math.abs(t - ev.at) > 3 * MIN) continue;
    const fw = String(f.event).toLowerCase();
    const score = words.filter(w => fw.includes(w)).length + 0.5;
    if (score > bestScore) { bestScore = score; best = f; }
  }
  if (!best) return null;
  const unit = String(best.unit || "").trim().toUpperCase();
  return String(best.actual) + (["%", "K", "M", "B", "T"].includes(unit) ? unit : "");
}
