# News Alert Dashboard: README

**Version:** 1.1, 2026-10-23. Built into the main dashboard (`index.html`).
**Spec:** `news-alert-dashboard-spec.md` (project)
**What it adds to the 35A dashboard:**
- **Alert Strip:** high-impact UK/US/EU events, 60 min before release, max 3 + "+N more", plus breaking crypto news.
- **Outcome Panel:** a bullish/bearish call per released event, from news + 5m/15m price, with "NEWS ≠ PRICE" when they disagree.
- **History:** each call's 1-hour result and the 30-day hit rate.
- **Active coins:** pre-filled from your 35A log.

## Changelog
| Version | Change |
|---|---|
| 1.1 | Built into the 35A dashboard: Alert Strip under the status bar (stays visible while you scroll), a new **News & Events** tab with a risk-count badge, dashboard colours, and coins read from the dashboard's TOKEN column (new coins switch on automatically). The widget is a single script (`news-widget.bundle.js`) so it also loads when `index.html` is opened from your computer; the News tab then asks once for your Netlify site address. The API allows that read (CORS). |
| 1.0 | Netlify Functions + Blobs backend, standalone `news.html`. |

## Files (upload all of them to the ROOT of your dashboard repo)
| File | What it does |
|---|---|
| `index.html` | **Your dashboard, updated**: News strip + News & Events tab. Replaces your current `index.html`. It has 6 small additions, each marked with a `News Alert` comment. |
| `netlify.toml` | Tells Netlify where the functions are. **If you already have a `netlify.toml`**, copy the `[functions]` block into it instead of replacing the file. |
| `package.json` | Adds the `@netlify/blobs` package (Netlify installs it automatically). **If you already have a `package.json`**, add the `"@netlify/blobs": "^11.1.6"` line to its `dependencies` instead. |
| `netlify/functions/news-poll.mjs` | Runs **every 2 minutes** on Netlify. It fetches the calendar, crypto news and MEXC prices, and works out the calls. |
| `netlify/functions/news-state.mjs` | The page reads the data from `/api/news`. |
| `netlify/news-lib/engine.mjs` | The poll logic: outcomes, price reaction, history, LLM note. |
| `news/core.mjs` | Shared rules: news signal, price signal, combined call, feed parsers. |
| `news/news-widget.bundle.js` | **What the pages load**: one ordinary script (widget + core). It's built from `news-widget.js` + `core.mjs`; edit those, not the bundle. |
| `news/news-widget.js`, `news/news-widget.css` | Widget source and styles. With `NEWS_WIDGET = { embed: true }` it uses the dashboard's colours and coins. |
| `news.html` | Optional standalone page with everything on it: `yoursite.netlify.app/news.html` |
| `crypto-events.json` | **Your** scheduled crypto events (ETF decisions, listings). Edit it on github.com. |

## Install (GitHub web upload, no git needed)
1. Unzip `news-alert-dashboard.zip` on your computer.
2. On github.com, open your dashboard repo and click **Add file → Upload files**. Drag in **the contents** of the unzipped folder (the `netlify` and `news` folders and the 4 files), then click **Commit changes**.
3. Netlify deploys automatically. In Netlify, open your site and go to its **Functions** list (under **Logs → Functions** in the current layout). You should see `news-poll` (marked Scheduled) and `news-state`.
4. Open your dashboard. The **News strip** is under the status bar and the **News & Events** tab is next to Equity & Drawdown. The first data appears within 2 minutes. To fill it straight away, open `news-poll` in Netlify's Functions list and click **Run now**.
5. **Opening `index.html` from your computer (offline):** your dashboard works as before. The News tab asks once for your site address (e.g. `https://your-site.netlify.app`) and then reads the news from there.

**Try it first without deploying anything:** `news.html?demo=1` shows sample data. The dashboard itself has no demo switch; it shows live data once deployed.

## Optional keys (Netlify → Site configuration → Environment variables)
| Variable | Effect if set | Without it |
|---|---|---|
| `FINNHUB_API_KEY` | Fills in the **actual** values (CPI 3.4% vs 3.1%) automatically, if your Finnhub plan includes the economic calendar | You type the actual in the card (one box per event). The news signal then appears straight away. |
| `ANTHROPIC_API_KEY` | Adds a short Claude note per event, plus a line explaining why news and price disagree | The rule-based reason is shown instead |
| `ANTHROPIC_MODEL` | The Claude model to use (default `claude-sonnet-4-5`) | Change it if Anthropic retires that model |

Redeploy after adding a key: **Deploys → Trigger deploy**.

## Data sources (all free)
- **Calendar:** Forex Factory weekly feed (`nfs.faireconomy.media`). It gives the time, impact, forecast and previous values, and is refreshed every 30 min. It has **no actual values**; those come from Finnhub or from you.
- **Crypto news:** the CoinDesk + Cointelegraph RSS feeds. Only headlines with a high-impact word (SEC, ETF, delist, hack, lawsuit, …) **and** one of your coins are kept. CryptoPanic is not used, because its free plan was discontinued in early 2026.
- **Prices:** MEXC public futures 1-minute candles. BTCUSDT is the reference for macro events; the coin itself is used for crypto news.

## How the call is made
- **News signal** (actual vs forecast):
  - Inflation, jobs, GDP, PMI, retail sales and rate decisions **higher** than forecast → **Bearish** (fewer rate cuts).
  - Unemployment and jobless claims **higher** → **Bullish**.
  - Speeches have no number, so they get a price-only read.
- **Price signal:** the % move 5 and 15 min after release. A move under ±0.15% = flat.
- **Combined call:**
  - News and price agree → **BULLISH / BEARISH**. Confidence ●●● when the 15m move is ≥ 0.5% and the 5m move agrees.
  - They disagree → **NEWS ≠ PRICE** (amber), with both readings shown.
  - No price yet → **INITIAL**.
  - No news number → **PRICE: …**
- **History:** after 2 hours each call moves to History with the 1-hour move. Only calls where news and price agreed are scored for the hit rate.

## Netlify usage
The poller runs 720 times a day (about 22,000 a month). The page asks for new data once a minute, and only while the tab is visible. This should fit Netlify's free plan for one user; check **Usage** in Netlify after the first week.

## Limitations
- Scheduled functions only run on the published (production) deploy, not on deploy previews.
- Breaking news arrives with the RSS delay, usually 1–5 min after publication, and is checked every 2 min.
- The Forex Factory feed covers **this week**. Next Monday's events appear when the feed rolls over.
- Your manual actuals, coin ticks and theme are saved in **this browser** only.
- The dashboard is dark-only, so the embedded News section follows that (the standalone `news.html` keeps Auto/Dark/Light).
- If you later change `index.html` in another session, keep the 6 `News Alert` additions (search for the comment).
