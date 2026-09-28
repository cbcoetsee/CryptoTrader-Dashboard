// netlify/functions/trades.mjs
//
// A tiny REST-ish API backing the dashboard's "shared source of truth"
// across devices. Netlify Blobs gives us a simple key-value store with no
// separate database to provision — everything about this account's trade
// data lives under one key.
//
// GET    /api/trades  -> the currently saved payload, or null if nothing
//                        has been saved yet
// PUT    /api/trades  -> replace the saved payload (the dashboard always
//                        sends its *entire* working state — records +
//                        meta + starting balance override — so this is a
//                        simple "last write wins" overwrite, which is fine
//                        for a single person using a handful of devices)
//
// This function trusts that only authenticated requests reach it — the
// auth-gate edge function in front of the whole site is what actually
// keeps this private, not anything in here.

import { getStore } from '@netlify/blobs';

const STORE_NAME = 'bar-replay-dashboard';
const KEY = 'shared-state';
// Netlify's own function request-body ceiling is ~6MB (and lower still for
// content treated as binary), so an 8MB self-imposed cap here was already
// unreachable in practice — this is now set safely under the real platform
// limit instead. The dashboard strips freshly-pasted chart screenshots out
// of what it syncs specifically so normal trade-data payloads stay tiny
// (tens of KB, not MB) and comfortably clear of either ceiling.
const MAX_BODY_BYTES = 4 * 1024 * 1024; // 4MB

function jsonResponse(body, status) {
  return new Response(body == null ? null : JSON.stringify(body), {
    status: status || 200,
    headers: { 'content-type': 'application/json' },
  });
}

export default async (req) => {
  const store = getStore(STORE_NAME);

  if (req.method === 'GET') {
    const existing = await store.get(KEY, { type: 'json' });
    return jsonResponse(existing ?? null);
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return jsonResponse({ error: 'Payload too large.' }, 413);
    }
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (e) {
      return jsonResponse({ error: 'Invalid JSON body.' }, 400);
    }
    payload.savedAt = new Date().toISOString();
    await store.setJSON(KEY, payload);
    return jsonResponse({ ok: true, savedAt: payload.savedAt });
  }

  if (req.method === 'DELETE') {
    await store.delete(KEY);
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
};

export const config = {
  path: '/api/trades',
};
