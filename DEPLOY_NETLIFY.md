# Deploying to Netlify — password-gated, shared across devices

This turns the dashboard from "a file on one computer" into "a private URL
you can open from your phone or laptop, where every device sees and edits
the same trade data." It adds three things to the plain dashboard:

1. **Password gate** — the whole site (pages, images, and the API) requires
   a password before anything is served, at Netlify's network edge, before
   your app ever loads.
2. **Shared source of truth** — trades you add/edit/delete from *any*
   device save to a small cloud store, and every other device reads from
   that same store. No more "I added a trade on my phone but my laptop
   doesn't know about it."
3. Everything else about the dashboard — the analysis, the charts, the
   design — is unchanged.

**Honest trade-off, stated plainly:** your trade data now lives on
Netlify's servers, not only on your devices. The password gate keeps it
away from casual visitors and search engines, but it's a single shared
password checked at the edge — solid for keeping a personal dashboard
private, not the kind of thing a bank would rely on. If that's a dealbreaker,
the self-hosted-plus-Tailscale route I mentioned earlier keeps everything
entirely off any third-party server instead.

## What's in this package

```
netlify.toml                        Tells Netlify where everything is
netlify/
  functions/trades.mjs               The shared-data API (reads/writes Netlify Blobs)
  edge-functions/auth-gate.js        The password gate, in front of everything
public/
  index.html                         The dashboard itself
  data/charts/                       Your ~39 existing chart screenshots
package.json                        Declares the one dependency the API needs
```

## Step 1 — Get these files into your GitHub repo

Simplest path: replace the contents of your existing repo with this folder's
contents (keep it as the repo root — `netlify.toml` needs to sit at the top
level). If you'd rather keep your current repo layout and just add these
files alongside it, that's fine too — just open `netlify.toml` and change
`publish = "public"` to wherever your `index.html` actually lives.

```
git add -A
git commit -m "Add Netlify Functions, edge auth gate, and shared cloud sync"
git push
```

## Step 2 — Create the Netlify site

1. Go to [app.netlify.com](https://app.netlify.com) and sign up / log in
   (free plan is all you need for this).
2. **Add new site → Import an existing project**.
3. Connect GitHub, and pick this repository.
4. Netlify should auto-detect the settings from `netlify.toml` (publish
   directory `public`, functions directory `netlify/functions`). Leave the
   build command blank — there's no build step, it's already static.
5. Click **Deploy**. Don't worry that the site isn't password-protected yet
   — the very first deploy will actually be *blocked entirely* (a 500
   error) until you complete Step 3, because the auth gate fails closed
   without a password configured.

## Step 3 — Set your password

1. In your new site: **Site configuration → Environment variables**.
2. **Add a variable** → Key: `DASHBOARD_PASSWORD`, Value: whatever password
   you want to use → **Create variable**.
3. **Deploys → Trigger deploy → Deploy site** (redeploy once so the edge
   function definitely picks up the new variable).

## Step 4 — Test it

1. Open your site's URL (something like `https://your-site-name.netlify.app`)
   in a private/incognito window, so you're testing as a fresh visitor.
2. You should land on a login page, **not** the dashboard.
3. Try an obviously wrong password — confirm it's rejected.
4. Enter the real password — you should land on the dashboard, and the
   status bar (top of the page) should show a green **"Shared (cloud)"**
   pill with **"Synced across your devices"** underneath it. That confirms
   the shared-data API is working, not just the password gate.
5. Add a test trade, then open the same URL on your phone (or another
   browser) and log in — the test trade should already be there.
6. Delete the test trade from either device to clean up.

If step 4.4 shows "Embedded sample" instead of "Shared (cloud)" after
logging in, the site loaded but the `/api/trades` function isn't
responding — double check `netlify/functions/trades.mjs` deployed (Netlify's
**Functions** tab in the dashboard should list `trades`), and check the
function's logs there for errors.

## Using it day to day

- **Bookmark it, or "Add to Home Screen"** on your phone for quick access.
- You'll need to log in again on each new browser/device (or after ~30
  days) — that's the session cookie expiring, working as intended.
- To change the password later, just update the `DASHBOARD_PASSWORD`
  environment variable and redeploy. Everyone will need to log in again.
- To sign out on a device, visit `/__logout`.
- The chart-upload/paste feature still works exactly as before — new
  screenshots you attach are compressed and synced along with everything
  else. If you attach a lot of large screenshots, be aware the shared data
  store has an 8MB-per-save ceiling (configurable in `trades.mjs` if you
  need more) — plenty of room for trade data plus a handful of new charts.

## Reverting to local-only

Nothing about the plain local-file experience changed — `public/index.html`
still works perfectly if you just open it directly on one computer (double-click,
no Netlify, no password), it simply won't have anyone to sync with. The
cloud sync only activates when it can actually reach `/api/trades`, so the
same file is genuinely both things at once depending on how it's opened.
