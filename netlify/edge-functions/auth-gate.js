// netlify/edge-functions/auth-gate.js
//
// Netlify's own dashboard password-protection is a paid-plan feature now.
// This is a free-tier equivalent: every request to the site (pages, static
// assets, and the /api/trades function) passes through here first. Without
// a valid session cookie, it shows a small login page instead of whatever
// was actually requested.
//
// Honest scope: this is meant to keep a personal dashboard from being
// casually stumbled on or indexed — a single shared password, checked at
// the edge. It is not meant to withstand a determined, targeted attacker
// the way real per-user authentication would. That's a reasonable trade
// for a personal trading journal; it would not be for anything more
// sensitive than that.

const COOKIE_NAME = 'br_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  });
  return out;
}

function loginPage(errorMessage) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in — Bar Replay</title>
<style>
  :root{--bg-0:#0a0e14;--bg-2:#131a24;--border:#232c3a;--border-strong:#334155;--text-1:#eef2f7;--text-3:#63707f;--amber:#f0a825;--down:#f5495c;}
  *{box-sizing:border-box;}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg-0);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;}
  form{background:var(--bg-2);border:1px solid var(--border-strong);border-radius:14px;padding:28px;width:280px;box-shadow:0 20px 60px -20px rgba(0,0,0,.7);}
  h1{font-size:15px;color:var(--text-1);margin:0 0 4px;}
  p.sub{font-size:11.5px;color:var(--text-3);margin:0 0 18px;}
  input{width:100%;padding:9px 11px;border-radius:7px;border:1px solid var(--border-strong);background:var(--bg-0);color:var(--text-1);margin-bottom:14px;box-sizing:border-box;font-size:13px;}
  input:focus{outline:none;border-color:var(--amber);}
  button{width:100%;padding:9px;border-radius:7px;border:none;background:var(--amber);color:#1a1206;font-weight:700;font-size:13px;cursor:pointer;}
  button:hover{background:#ffc247;}
  .err{color:var(--down);font-size:12px;margin:-6px 0 14px;}
</style></head>
<body>
  <form method="POST" action="/__login">
    <h1>Bar Replay — Setup Research</h1>
    <p class="sub">Enter the dashboard password to continue.</p>
    ${errorMessage ? `<div class="err">${errorMessage}</div>` : ''}
    <input type="password" name="password" placeholder="Password" autofocus required autocomplete="current-password">
    <button type="submit">Sign in</button>
  </form>
</body></html>`;
}

export default async (request, context) => {
  const password = Netlify.env.get('DASHBOARD_PASSWORD');
  if (!password) {
    // Fail closed: if the password was never configured, refuse to serve
    // anything rather than accidentally leaving the site wide open.
    return new Response(
      'DASHBOARD_PASSWORD is not set. In the Netlify UI: Site configuration → Environment variables → add DASHBOARD_PASSWORD, then redeploy.',
      { status: 500, headers: { 'content-type': 'text/plain' } }
    );
  }

  const expectedToken = await sha256Hex(password + '::bar-replay-session-v1');
  const url = new URL(request.url);

  if (url.pathname === '/__login' && request.method === 'POST') {
    const form = await request.formData();
    const submitted = String(form.get('password') || '');
    if (submitted === password) {
      const headers = new Headers({ Location: '/' });
      headers.append(
        'Set-Cookie',
        `${COOKIE_NAME}=${expectedToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`
      );
      return new Response(null, { status: 302, headers });
    }
    return new Response(loginPage('Incorrect password.'), {
      status: 401,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  if (url.pathname === '/__logout') {
    const headers = new Headers({ Location: '/' });
    headers.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; Max-Age=0`);
    return new Response(null, { status: 302, headers });
  }

  const cookies = parseCookies(request.headers.get('cookie'));
  if (cookies[COOKIE_NAME] === expectedToken) {
    return context.next();
  }

  return new Response(loginPage(), {
    status: 401,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
};

export const config = {
  path: '/*',
};
