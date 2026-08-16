# Master Prompt — Crypto Trading Setup-Research Dashboard

Use this prompt to (re)build the Bar Replay setup-research dashboard from
scratch, or to brief another AI assistant on the same project. It assumes
you're starting from a trade-journal Excel workbook similar in spirit to
`35A - Bar Replay.xlsx` (an Elliott-wave crypto trade log with a header row,
one row per trade, dropdown-validated categorical columns, and a numeric P&L
column) — the dashboard should not hard-code that exact schema, but the
brief below uses it as the running example.

---

## 1. Goal

Build a polished, offline-first crypto trading research dashboard as a local
webpage, using an Excel trade-journal workbook as the source of truth.
Deliver a desktop-friendly dashboard that runs locally, works fully offline,
and allows a manual Excel upload. The primary user journey is: setup-analysis
research first, then drill into individual trades, with the ability to
maintain the ledger by hand (add/edit/delete trades) going forward.

## 2. Visual design direction

- Bybit-inspired visual language only: dark graphite/navy background, warm
  amber accent, muted blue secondary accent, compact exchange-style cards and
  tabs, high-contrast typography (a monospace font with tabular figures for
  all numeric/data cells), refined borders and hover states.
- Do not copy any real exchange's logos, brand assets, wording, or page
  structure — this is an original design merely inspired by that genre of
  product.
- Professional, data-dense, responsive, easy to scan. Desktop-first, with
  reasonable tablet/mobile behavior (stacking KPI grid, full-width side
  panels on narrow screens, horizontally scrollable tabs).
- Green/red for wins/losses and P&L sign, amber for primary actions and
  active-state highlights, blue as a secondary accent. Badges/pills for
  categorical values (outcome, direction, yes/no factors).

## 3. Source-data handling (must generalize beyond one workbook)

- Preserve all data from the source workbook; don't drop columns.
- Auto-detect which column is the numeric P&L ("Actual P&L") field by
  scoring header names (prioritize headers containing "actual" + "p&l"/"pnl",
  then plainer "p&l"/"pnl"/"p/l", then "profit"), cross-checked against what
  fraction of the column's values actually parse as numbers, and excluding
  percentage/balance columns. Treat that numeric field as the sole source of
  truth for performance metrics; exclude blank/non-numeric P&L records from
  performance metrics (they may still appear in the raw ledger as
  "pending"/incomplete rows).
- If detection is ambiguous or fails, don't guess silently — show a banner
  explaining the situation with a dropdown letting the person confirm or
  correct which column is the P&L field, and recompute everything live when
  they do.
- Auto-detect the date column (prefer a header containing "date"), and
  auto-detect win/loss/breakeven purely from the sign of the numeric P&L
  (positive/negative/zero) rather than trusting any separate manually-set
  "result" column the workbook might have, since the two can drift out of
  sync.
- Infer categorical "setup factor" fields generically: a column is a factor
  candidate if it's low-cardinality (roughly ≤20 distinct values, or a
  fraction of the row count) and isn't the P&L field, date field, a
  percent-of-P&L field, or an account-balance/growth/chart/notes-style field.
  Low-cardinality numeric-looking columns (e.g. Fibonacci retracement
  levels) should still count as categorical/factor fields, not continuous
  numeric fields, since they function as discrete setup criteria. Require a
  reasonable population density too (e.g. at least ~30% of rows populated,
  not just ≥2) — a mostly-empty column that happens to have only a couple of
  distinct stray values is a sparse note field, not a real recurring factor.
- Determine a sheet's true populated column count by scanning actual cell
  values (header row and data rows), not the workbook's own reported
  dimensions — spreadsheet software frequently records empty, merely
  *formatted* cells far to the right of the real data (e.g. from a big
  "make this a table" selection), which would otherwise get synthesized into
  meaningless blank extra columns cluttering every field list in the UI.
- If the workbook's own running-balance/equity column doesn't match a
  straightforward cumulative sum of P&L (e.g. because rows were entered out
  of chronological order and a formula reference drifted), don't trust it —
  recompute equity independently by summing each trade's P&L in chronological
  order, and say so explicitly in an assumptions panel.
- Extract the workbook's own dropdown lists (Excel/Sheets data-validation
  lists) per column, unioning values across multiple validation ranges for
  the same column (a list can legitimately grow over the life of a workbook,
  e.g. more tokens added over time) — these become the option lists used
  later when adding/editing trades, so the person always sees the exact same
  choices they'd see typing into the spreadsheet itself.
- Embed an initial data snapshot in the webpage so it works with zero setup.
- Enable importing a replacement `.xlsx` file locally in the browser (client-
  side parsing only).
- Validate the imported workbook and handle missing/ambiguous columns
  gracefully with clear banners — never a blank screen or a silent crash.

## 4. Dashboard scope

### 4.1 Setup-analysis research (highest priority, default landing tab)

- Rank every meaningful factor/value combination by total P&L, with trade
  count, wins, losses, break-evens, win rate, total P&L, average P&L, average
  winner, average loser, profit factor, and expectancy.
- Two modes, toggled with a segmented control:
  - **Single Factor**: every individual (field, value) pair flattened into
    one ranked table (e.g. `Token = ETH`, `Trend Break = Yes` each as their
    own row), sortable by any column, searchable, with a multi-select
    "Factors" control choosing which fields are included.
  - **Setup Signatures**: full combinations across a person-chosen subset of
    factor fields (e.g. `Token = SOL` AND `Direction = LONG`), grouped and
    ranked the same way, requiring a configurable minimum trade count
    (floor of 2) before a combination is shown. Ship with a sensible default
    factor selection that actually produces a few multi-trade combinations
    out of the box, not an empty table.
  - A "View trades →" action on any row jumps to the Ledger tab pre-filtered
    to exactly that factor/value (or signature).
- Clear empty states when nothing meets the minimum-trade threshold, with a
  suggestion to loosen the filters.

### 4.2 Individual trade drill-down

- A searchable (full-text across every field), filterable (per-factor
  multi-select, outcome, date range) trade ledger table, sortable by any
  column.
- Clicking a trade opens a side panel with every source field grouped into
  logical sections (Setup Criteria / Result / Chart / Other source fields),
  plus calculated context: cumulative P&L to that point, running balance at
  that point, Trade Risk (see §5), and the trade's rank by P&L among all
  usable trades. Keep source values visible and accurately formatted
  (currency, percentages, dates, Yes/No badges, direction badges, and an
  actual rendered image — not raw text — for any attached chart screenshot).

### 4.3 Equity and drawdown

- A running equity curve and a drawdown chart, built from chronological
  usable P&L records only, rendered as hand-built SVG (no charting library,
  no online dependency) with hover tooltips.
- Summary cards: starting balance, ending balance, net P&L, max drawdown ($
  and %), best/worst trade, best win streak / worst loss streak.
- An expandable "Assumptions & data notes" panel stating exactly how the
  starting balance and chronological order were determined, including any
  caveats about same-day trade ordering (no intraday timestamp) or workbook
  data-quality issues found.

## 5. Trade management (add / edit / delete / clear)

This is core functionality, not an afterthought — the dashboard should feel
like a living trade journal, not a read-only report.

- **Add Trade**: a form built dynamically from the current dataset's schema
  (don't hard-code field names) — but laid out in a specific, curated order
  rather than raw column order, since that reads much more naturally than a
  spreadsheet-column dump: date first, then a calculated risk-sizing figure
  (see below), then token/direction, then every setup factor, then the
  "result" fields grouped together at the end (any pass/fail outcome field,
  the win/loss/breakeven field, P&L, P&L%, and the chart screenshot last).
  For every field that has a workbook dropdown list (extracted per §3),
  render a real `<select>` with those exact options. For other categorical
  fields, offer the currently-observed distinct values as a dropdown plus an
  "Other…" option that reveals a free-text input. Give the P&L field a number
  input and the date field a date input. No field should be hard-required
  beyond what's sensible — allow partial/incomplete trades to be saved (they
  just won't count toward performance metrics until a numeric P&L is
  present). Don't bury useful fields in a collapsed "other" section — if a
  field matters enough to exist, give it a place in the one visible form;
  drop genuinely low-value fields (workbook-internal running totals/averages,
  the blank formatting-artifact columns from §3) from the form entirely
  rather than hiding them behind a low-value "optional" disclosure.
- **A calculated risk-sizing field** (e.g. "Trade Risk" = a fixed percentage
  of account balance): computed automatically, shown read-only right after
  the date, and snapshotted onto the record when the trade is saved so it
  stays a historically accurate fact even as the account balance moves later.
  Use the current overall ending balance when adding a new trade; use the
  balance that existed immediately *before* that specific trade in the
  chronological sequence when editing an existing one.
- **Any field that's mathematically derived from another visible field**
  (e.g. a P&L-percentage field, which is always P&L relative to the same
  balance basis the risk-sizing field uses) should be calculated and
  read-only too, not a second manually-typed number that can drift out of
  sync with the first — and it should recalculate live as the person edits
  the field it depends on, not just once when the form opens.
- **Chart screenshots**: let a trade's chart/screenshot-style field accept a
  pasted image (clipboard paste while the field is focused), a dragged file,
  or a click-to-browse file picker — not just a text value. Downscale and
  re-compress on the client (e.g. via an offscreen canvas) before storing, so
  a multi-megabyte screenshot doesn't bloat local storage. If the source
  workbook already has screenshots embedded in that column (common in a
  hand-maintained trade journal — Excel/Sheets embeds these as drawing
  objects anchored to a cell, not as a cell value), extract them too: parse
  the workbook's drawing/relationship XML to resolve each embedded image to
  the row and column it's anchored to, and surface it exactly as if it had
  been pasted through the app, so historical trades show their real charts
  from day one. For a *build-time* embedded snapshot specifically, write
  extracted images out as individual files alongside the page rather than
  inlining them as base64 (which would balloon a page with dozens of
  screenshots to tens of megabytes) — reference them by relative path; for
  anything parsed live in the browser (an uploaded file, a live-refresh
  update), inline images as data URLs instead, since there's nowhere to
  write a file to. Provide a way to browse every attached screenshot in one
  place (e.g. a gallery grid, newest first, each thumbnail jumping to that
  trade's detail view) in addition to seeing one at a time per trade.
- **Edit Trade**: the same form, pre-filled, reachable from a trade's detail
  panel. Show a small badge on trades that have been added or edited this
  session so the person can always tell original data from their own edits.
- **Delete Trade**: reachable from the detail panel (and from the edit form),
  behind a confirmation dialog.
- **Clear ledger**: a clearly-separated destructive action (e.g. top of the
  Ledger tab) that removes every trade in one step, behind a confirmation
  dialog that requires an explicit "I understand this can't be undone"
  acknowledgement before the button is enabled.
- Every mutation must immediately recompute all derived state — column
  classifications, distinct values used in filters/dropdowns, every metric,
  chart, and table — without a page reload, and without discarding whatever
  the person was currently searching/filtering/sorting by elsewhere in the
  app.
- Persist trade edits locally (e.g. browser local storage) so they survive a
  page refresh, scoped to that device only — nothing leaves the browser. On
  load, if a saved session is found, restore it and say so with a banner that
  offers a one-click "discard and start over." Guard every path that could
  otherwise silently discard unsaved edits — importing a new file, resetting
  to the embedded sample, and (in live-refresh mode) the source file changing
  on disk — with a confirmation instead of a silent overwrite. Fail
  gracefully (edits just don't persist across a refresh, nothing crashes) in
  browser contexts where local storage isn't available, such as some
  browsers when a page is opened directly as a local file rather than served
  over http.

## 6. Configurable starting balance

The equity curve's starting balance should be a visible, editable parameter
(not just an inferred constant) — expose it as a number input near the
equity chart, pre-filled with whatever was auto-detected (or 0 if nothing
could be inferred), with an "Auto-detect" action to revert to the inferred
value. Changing it should immediately recompute the equity curve, ending
balance, drawdown, and the assumptions text to reflect that it's now
manually set.

## 7. Live auto-refresh (server mode)

- In addition to the "just open the HTML file" offline mode, provide a tiny
  local launcher (e.g. a stdlib-only Python script) that serves the folder
  over `http://localhost` and opens the browser automatically.
- While running under that server, the page should detect (poll) changes to
  the workbook file on disk and refresh itself automatically, without a
  manual re-upload or page reload — but never at the expense of unsaved
  manual edits (see §5's guard requirement).
- Falling back gracefully when no server is present (plain file mode still
  works fully, just without auto-refresh; a small status-bar hint suggests
  the launcher for that capability).

## 8. Usability

- Clear, specific empty/error states everywhere data could be missing,
  ambiguous, or zero (no data imported yet, a filter returns nothing, no
  numeric P&L column found, a workbook has header-only/no data rows, an
  uploaded file isn't a valid `.xlsx`, etc.) — explain what happened and what
  to do next, never fail silently or show a blank panel.
- Responsive layout: desktop-first, with the KPI grid, tables, and side
  panels adapting sensibly down to tablet/mobile widths.
- Keep all processing client-side / on the local machine — no data leaves
  the device at any point, including during import, editing, or live-refresh
  polling.
- A persistent status indicator showing the active source's filename, sheet
  name, row/usable-row counts, last refresh time, and current mode (embedded
  sample / uploaded file / live server).
- Concise launch instructions (a README) covering both the zero-setup file
  mode and the optional live-refresh server mode.

## 9. Technical constraints and quality bar

- Build with clean, maintainable HTML/CSS/JavaScript and **no external
  dependencies or CDNs** — the page must work with the network fully
  disconnected. That includes the `.xlsx` parser itself: implement ZIP
  extraction and the OOXML spreadsheet format from scratch using native
  browser APIs (e.g. `DecompressionStream` for inflate, `DOMParser` for the
  embedded XML), rather than pulling in a third-party spreadsheet library.
- Reconcile every displayed total against the source data — if the sample
  workbook's own totals don't match a straightforward recomputation (as can
  happen with hand-maintained formulas), trust the recomputation and note
  the discrepancy rather than silently displaying the workbook's figure.
- Validate imported workbooks and handle missing/renamed columns gracefully
  rather than assuming a fixed schema.
- Deliver the dashboard (a single self-contained HTML file is preferable for
  portability — except any pre-existing embedded images extracted per §5,
  which should ship as a companion folder of files rather than bloating the
  HTML) plus the local launcher and a copy of the source workbook (for
  live-refresh mode), ready to use straight from the desktop — no build step
  required by the end user.

## 10. Suggested verification before calling it done

Because so much of this runs entirely client-side with no backend to
inspect, verify behavior with real (headless-browser or DOM-emulator-based)
end-to-end tests rather than relying on visual inspection alone, covering at
minimum: parsing the real source workbook correctly; the full add → edit →
delete → clear-ledger flow, including that dropdown fields actually contain
the workbook's real validation lists and that the calculated risk-sizing
field produces the right number in both add and edit mode; the chart
screenshot flow (both pre-existing embedded images and a freshly
pasted/uploaded one, in the form, the detail view, and the gallery); the
starting-balance override; local persistence surviving a simulated reload;
graceful behavior when local storage is unavailable; and, if live-refresh is
implemented, that a file change on disk is picked up automatically *and*
that it never clobbers unsaved manual edits. When testing in a DOM emulator
rather than a real browser, double check emulator-specific gaps before
trusting a failure (e.g. canvas/image-decoding support, `URL.createObjectURL`
availability) so a missing test-environment feature isn't mistaken for an
application bug — and conversely, don't wave away a genuine failure as "just
the test environment" without actually confirming that.
