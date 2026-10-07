import { apiBase } from "@/lib/api";
import { PAGE_PATHS, hiddenPaths, normalizeConfig } from "@/lib/sections";

// Used by middleware. A prerendered page keeps answering 200 from the ISR cache even when its own code calls
// notFound(), so hidden pages are stopped here before the cache is reached. The hidden list is kept in memory
// for 30 seconds, so a page hidden in the admin panel answers 404 within about a minute.
const TTL_MS = 30_000;
let cached: { at: number; paths: string[] } = { at: 0, paths: [] };

async function currentHidden(now = Date.now()): Promise<string[]> {
  if (now - cached.at < TTL_MS) return cached.paths;
  // Set before the fetch so a slow or failing API is not retried by every request. On failure the last good list stays.
  cached = { at: now, paths: cached.paths };
  try {
    const res = await fetch(`${apiBase()}/site/config`, { cache: "no-store", signal: AbortSignal.timeout(2000) });
    if (res.ok) cached = { at: now, paths: hiddenPaths(normalizeConfig(await res.json())) };
  } catch {
    // keep the previous list
  }
  return cached.paths;
}

const HIDEABLE = new Set(Object.values(PAGE_PATHS));

/** True when this request is for a hideable page that the admin has hidden. */
export async function isHiddenRequest(pathname: string): Promise<boolean> {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (!HIDEABLE.has(path)) return false;
  return (await currentHidden()).includes(path);
}
