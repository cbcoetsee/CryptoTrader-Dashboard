# Crypto Trading Dashboard

A local, offline-first research dashboard for the `35A - Bar Replay.xlsx` trade
journal. Everything runs in your browser — no data ever leaves your device,
and no internet connection is required.

## Quick start (offline, no setup)

Just double-click **`index.html`**. It opens in your default browser with the
workbook's data already built in, ready to explore — including the ~39 chart
screenshots already pasted into the workbook's own CHART column, which live
alongside `index.html` in `data/charts/`. This works with no installation,
no server, and no internet connection (see "What's in this folder" for the
one nuance this adds to portability).

To analyze a different (or updated) workbook, click **Import .xlsx** in the
top-right corner and pick a `.xlsx` file. Parsing happens entirely on your
machine — the file is never uploaded anywhere.

## Adding, editing, and deleting trades

The Trade Ledger tab has an **+ Add Trade** button that opens a form built
from the workbook's own fields, in the order a trader actually fills them
in: Date, then a live-calculated **Trade Risk** figure, then the setup
criteria, then the result fields (Profit Passed 1:3RR, P/L/BE, P&L, P&L %,
Chart) grouped together at the end. Fields like Day of Week, Token, Trend
Break, and the Fibonacci wave levels show up as actual `<select>` dropdowns
with the exact choices from the source workbook's data validation (e.g. Day
of Week is always MON–SUN, Trend Break is always Yes/No), the same way
they'd appear as dropdowns in Excel. Fields without a workbook dropdown offer
your dashboard's existing values as suggestions plus an "Other…" option for
something new.

**Trade Risk** is calculated automatically as 2% of the relevant account
balance — the current overall ending balance when adding a new trade, or the
balance that existed immediately before that specific trade when editing an
existing one (so it stays historically accurate). It's read-only; whatever
value is shown gets snapshotted onto the trade when you save. **P&L %**
works the same way — it's always P&L relative to that same balance, so it
recalculates live as you type a P&L value rather than needing to be entered
separately.

**Chart** lets you paste a screenshot directly (Ctrl/Cmd+V while the field is
focused), drag a file onto it, or click to browse — no separate upload step.
Images are automatically downscaled and re-compressed so they don't bloat
your session. Use the **View Charts** button (top of the Trade Ledger tab) to
browse every screenshot attached across all trades in one grid, old and new
alike — click any thumbnail to jump to that trade's detail panel.

Click any trade in the ledger to open its detail panel, then **Edit trade**
or **Delete trade** from there. Trades you've added or edited this session
are marked with a small badge so you can always tell what's original vs. new.

**Clear ledger** (top of the Trade Ledger tab) removes every trade in one
step — it's meant for starting a fresh session, so it asks you to confirm and
check an acknowledgement box first since it can't be undone from inside the
app (re-import the workbook, or use "Reset to sample," to get the data back).

All of this recalculates every metric, chart, and filter live — nothing
requires a page reload.

### Your edits stick around

Trades you add, edit, or delete are saved to your browser's local storage as
you go, so they're still there if you refresh the page or close and reopen
the tab — this device only, nothing is sent anywhere. If the dashboard finds
a saved session on load, it tells you with a banner that also offers
**Discard and start over** if you'd rather begin fresh.

Because of that, importing a new file, using **Reset to sample**, or (in
server mode) a workbook changing on disk will all ask you to confirm first if
you have unsaved edits, instead of silently overwriting them.

One caveat: browsers vary in whether they allow local storage for a page
opened directly as a file (`file://`) rather than through a server — Chrome
and Firefox generally do, but if yours doesn't, editing still works perfectly
within that session, your edits just won't survive a refresh. Running via
`server.py` (below) sidesteps this entirely, since it gives the page a normal
`http://localhost` address.

## Configurable starting balance

The Equity & Drawdown tab has a **Starting Balance** field at the top. By
default it's auto-detected from the workbook (or defaults to $0 / cumulative
P&L if no balance column is found) — type your own value to see the equity
curve, ending balance, and drawdown recalculated against it, and click
**Auto-detect** to go back to the inferred value.

## Deploying to Netlify (shared, password-protected, access anywhere)

Want to open this dashboard from your phone and laptop with the same trade
data on both, behind a password? See **`DEPLOY_NETLIFY.md`** in the
`bar-replay-dashboard-netlify` package — it adds a password gate and a
small shared-data backend (Netlify Functions + Blobs) on top of this same
dashboard, so every device reads and writes the same trades. Everything
described above still works unchanged when the file is just opened locally
instead — the cloud sync only activates when it's actually deployed there.

## Live auto-refresh (optional)

If you're actively editing the workbook in Excel/Sheets and want the
dashboard to update itself automatically as you save, run the included
launcher instead of opening `index.html` directly:

```
python3 server.py
```

(Windows users: double-click `server.py` if `.py` files are associated with
Python, or run `py server.py` / `python server.py` from a command prompt.
Requires Python 3 — no extra packages, only the standard library.)

This starts a small local web server (`http://localhost:8420` or the next
free port) and opens the dashboard in your browser automatically. While it's
running, edit and save **`data/35A - Bar Replay.xlsx`** (keep the same file
name) and the dashboard will detect the change and refresh itself within a
few seconds — no manual re-upload, no page reload. The status bar shows a
"Live server" indicator and the file it's watching while this mode is active.

Close the terminal window (or press `Ctrl+C`) to stop the server. The
dashboard still works fine without it — you'll just be back to manual
`Import .xlsx` for picking up changes.

If the workbook changes on disk while you have unsaved manual edits in the
dashboard, auto-refresh won't silently overwrite them — you'll get a banner
explaining the conflict with a one-click option to discard your edits and
load the newer file, once you're ready.

## What's in this folder

```
index.html          The dashboard itself — HTML, CSS, JS, and an embedded
                     snapshot of the workbook's data are all in this one file.
server.py            Optional local launcher for the live auto-refresh mode.
MASTER_PROMPT.md      The full specification this dashboard was built from —
                      hand this to an AI assistant to regenerate or extend it.
data/
  35A - Bar Replay.xlsx   A copy of the workbook, used only by server.py for
                          live-refresh polling. Editing this file (in server
                          mode) is what triggers an auto-refresh.
  manifest.json           Tells the dashboard which file in data/ to watch.
  charts/                 ~39 chart screenshots already pasted into the
                          workbook's CHART column, extracted as individual
                          image files so index.html doesn't have to embed
                          ~15MB of images inline. index.html references
                          these by relative path, so keep the data/ folder
                          alongside it (don't move index.html on its own).
```

One nuance to the "single self-contained file" idea: the embedded sample's
chart screenshots live in `data/charts/`, not inside `index.html` itself —
otherwise the file would be tens of megabytes. Everything else (the trade
data, all calculations, the whole app) is still fully inline; only the
pre-existing screenshots need that folder. Anything you paste or upload
through the dashboard afterward is stored inline (in memory / local storage)
and doesn't need any file on disk.

Nothing here calls out to the internet. `index.html` has no `<script src>` to
any CDN and no analytics — open your browser's network panel while using it
and you'll see zero outbound requests (server mode aside, which only talks to
`localhost`).

## What the dashboard shows

**Setup Research** (the default tab) — ranks every setup factor and value by
realized performance. Toggle between:
- *Single Factor*: every individual factor/value pair (e.g. `Token = ETH`,
  `Trend Break = Yes`) ranked by total P&L, with win rate, profit factor,
  expectancy, and more. Pick which factors to include from the **Factors**
  dropdown.
- *Setup Signatures*: combinations of factors (e.g. `Token = SOL` **and**
  `Direction = LONG`) that repeated at least twice, ranked the same way. Add
  or remove factors to build your own signature, and raise the minimum trade
  count if you want higher-confidence setups only.

Click **View trades →** on any row to jump to the Ledger pre-filtered to
exactly those trades.

**Trade Ledger** — every trade, with full-text search, per-factor filters, an
outcome filter, and a date range. Click any row for a detail panel with every
source field, grouped into Setup Criteria / Result / Chart / Other, plus
calculated context (cumulative P&L to that point, running balance, Trade
Risk, and the trade's rank by P&L) — and buttons to edit or delete that
trade. Add new trades, browse attached charts, or clear the whole ledger from
the buttons at the top of this tab (see "Adding, editing, and deleting
trades" above).

**Equity & Drawdown** — a configurable starting balance, plus a running
equity curve and drawdown chart built from chronological, usable trades
only, with an "Assumptions & data notes" panel that explains exactly how
trade order was determined (worth a read — the workbook's own running-balance
column has a small formula inconsistency, which is why equity here is
recomputed independently from each trade's P&L rather than trusted from the
sheet).

## How "usable" trades are determined

Only rows with a numeric value in the P&L column count toward performance
metrics, win/loss/breakeven classification, and the equity curve — per the
brief, blank or non-numeric P&L rows are excluded from those calculations
(they can still appear in the raw ledger). The dashboard auto-detects which
column is the P&L column; if a workbook's column naming is ambiguous, a
banner appears letting you confirm or correct the choice.

## Importing other workbooks

The dashboard doesn't assume this exact spreadsheet layout — it infers
factors, the P&L column, and the date column from whatever `.xlsx` you give
it. If a workbook is missing something it needs (no numeric column that looks
like a P&L, no data rows at all, etc.), you'll get a clear message in a
banner explaining what's missing, rather than a blank screen or a crash.

## Browser requirements

Any recent (2023+) version of Chrome, Edge, Firefox, or Safari. The importer
relies on `DecompressionStream`, a standard browser API for reading `.xlsx`
files without any external library.
