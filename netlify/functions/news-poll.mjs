// Scheduled every 2 minutes: refreshes the calendar, crypto news, price reactions and history.
// Stores everything in Netlify Blobs (store "news", key "state").
import { getStore } from "@netlify/blobs";
import { poll, emptyState } from "../news-lib/engine.mjs";

const io = {
  async json(url) {
    const r = await fetch(url, { headers: { "user-agent": "35A-dashboard-news/1.0" } });
    if (!r.ok) throw new Error(`${r.status} ${url.split("?")[0]}`);
    return r.json();
  },
  async text(url) {
    const r = await fetch(url, { headers: { "user-agent": "35A-dashboard-news/1.0" } });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.text();
  },
  async post(url, body, headers) {
    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.json();
  },
};

export default async () => {
  const store = getStore("news");
  const state = (await store.get("state", { type: "json" })) || emptyState();
  const env = {
    SITE_URL: process.env.URL,                         // set by Netlify automatically
    FINNHUB_API_KEY: process.env.FINNHUB_API_KEY,      // optional: actual values
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,  // optional: LLM notes
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
  };
  const next = await poll(state, Date.now(), io, env);
  await store.setJSON("state", next);
};

export const config = { schedule: "*/2 * * * *" };
