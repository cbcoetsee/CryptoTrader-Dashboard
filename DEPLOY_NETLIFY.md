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

## Which zip do I deploy?

**Only this one** (`bar-replay-dashboard-netlify.zip`). The other zip,
`bar-replay-dashboard.zip`, is the plain local version — it has no shared-data
service and no password page, and it also contains a 21 MB copy of your
workbook meant only for the local launcher. If that one gets deployed to
Netlify by mistake, everything *looks* fine but trades only save in the
browser you added them in (see Troubleshooting below).

## What's in this package

```
netlify.toml                        Tells Netlify where everything is
netlify/
  functions/trades.mjs               The shared-data API (reads/writes Netlify Blobs)
  edge-functions/auth-gate.js        The password gate, in front of everything
public/
  index.html                         The dashboard itself
  data/charts/                       Your ~55 existing chart screenshots
package.json                        Declares the one dependency the API needs
```

## Step 1 — Get these files into your GitHub repo

Simplest path: replace the contents of your existing repo with this folder's
contents (keep it as the repo root — `netlify.toml` needs to sit at the top
level). If you'd rather keep your current repo layout and just add these
files alongside it, that's fine too — just open `netlify.toml` and change
`publish = "public"` to wherever your `index.html` actually lives.

**The repo's top level must look exactly like this** (open your repo on
github.com and compare before you let Netlify build):

```
netlify.toml
package.json
netlify/functions/trades.mjs
netlify/edge-functions/auth-gate.js
public/index.html
public/data/charts/...
```

If you see `index.html`, `data/`, `server.py`, or a nested
`bar-replay-dashboard-netlify/` folder at the top level instead, the wrong
files (or an extra folder level) got uploaded — delete them and upload the
*contents* of the unzipped `bar-replay-dashboard-netlify` folder.

If you use the github.com web page rather than git: **Add file → Upload
files**, drag in everything inside the unzipped folder, and commit. (With git
installed: `git add -A`, `git commit -m "..."`, `git push`.)

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
- **Chart screenshots you paste/upload do not sync across devices** — they
  stay only on the device you attached them from (still compressed, still
  saved there). This is deliberate, not a bug: screenshots can be several
  megabytes each, and serverless function requests have a hard size limit
  (Netlify's is roughly 6MB) — trying to sync images through the same
  channel as trade data would make syncing fragile for everything, so trade
  data (dates, P&L, every factor) always syncs reliably, and image
  attachments simply don't leave their originating device. The ~39
  screenshots already baked into `data/charts/` at deploy time are
  unaffected by this and remain visible on every device, since those are
  static files served to everyone, not part of the synced data.

## Troubleshooting

**Symptom: you add a trade, but it doesn't show on your other devices.**
Look at the top status bar. When shared sync is working it says **Shared
(cloud)** and **Synced across your devices**. If it instead says a red
**Shared sync OFF — changes stay in this browser only (HTTP 404)** (a banner
says the same), the site can't reach its shared-data service, so each browser
is keeping its own private copy. Check, in order:

1. **Open `https://YOUR-SITE/api/trades` directly** in a browser (while logged
   in). Working: a page showing `null` or a block of JSON. Broken: a
   "Page not found" / 404 page, or a login page.
2. **Netlify → your site → Deploys → the latest *Published* deploy** — the
   summary should list a Function named `trades`. If it doesn't, the
   `netlify/functions/trades.mjs` file didn't make it into the repo, or the
   wrong package was uploaded — re-check the "top level must look like this"
   list in Step 1.
3. **Was the latest deploy a failure?** Netlify keeps serving the last
   *successful* deploy, so a failed build can leave an older site live. Open
   the Deploys list and check the newest entry isn't red.
4. If the status says `HTTP 500` instead of 404, the function exists but is
   erroring — open **Logs → Functions → trades** in Netlify and send me what
   it says.

A trade you added while sync was OFF lives only in that one browser's storage;
it does **not** carry over once sync is switched on (the shared copy starts
from the embedded workbook). Just re-add it.

**Symptom: the site is slow, or Netlify bandwidth is climbing.** Older builds
re-downloaded the whole workbook every 5 seconds on hosted sites. Current
builds only do that on `localhost` (the local launcher), never on a deployed
site — make sure you've deployed the latest package.

**Two logins?** If your Netlify plan's own "private site" protection is turned
on, you'll sign in with Netlify first and then see this package's password
page. That's harmless but redundant; if you'd rather use only Netlify's
protection, delete `netlify/edge-functions/auth-gate.js` and redeploy.

**Heads-up once sync is on:** *Reset to sample* and *Import .xlsx* replace the
shared data for **every** device, not just the one you're on.

## Reverting to local-only

Nothing about the plain local-file experience changed — `public/index.html`
still works perfectly if you just open it directly on one computer (double-click,
no Netlify, no password), it simply won't have anyone to sync with. The
cloud sync only activates when it can actually reach `/api/trades`, so the
same file is genuinely both things at once depending on how it's opened.
