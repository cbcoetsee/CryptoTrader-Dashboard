// GET /api/news → the current Alert Strip / Outcome Panel / History data for the browser.
import { getStore } from "@netlify/blobs";
import { emptyState, publicView } from "../news-lib/engine.mjs";

export default async () => {
  const state = (await getStore("news").get("state", { type: "json" })) || emptyState();
  return new Response(JSON.stringify(publicView(state, Date.now())), {
    headers: { "content-type": "application/json", "cache-control": "no-store", "access-control-allow-origin": "*" },
  });
};

export const config = { path: "/api/news" };
