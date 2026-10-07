import type { PrismaClient } from "@prisma/client";
import { inWalesBox } from "./geo.js";
import { hidesAddress } from "./public.js";

// Precise coordinates for Near Me, from postcodes.io (public data, no key). Rules:
//  - Only listings that show their address are ever looked up. A listing that hides its address (checkbox or HomeBased)
//    has its postcode treated as personal data: it is never sent anywhere and its lat and lng are always cleared.
//  - Every lookup fails soft. A network error, a timeout or a bad reply returns null and nothing is thrown, so a
//    submission or an edit never waits on, or fails because of, this service.
//  - The backfill is idempotent (it only fills rows that have no coordinates) and rate limited (batches of up to 100
//    postcodes with a pause between requests).

export type LatLng = { lat: number; lng: number };
/** Resolves the postcodes it found. Returns null when the service could not be reached or replied badly. */
export type Geocoder = (postcodes: string[]) => Promise<Map<string, LatLng> | null>;

const BASE = () => process.env.POSTCODES_IO_URL ?? "https://api.postcodes.io";
export const GEO_TIMEOUT_MS = 4000;
export const GEO_BATCH = 100; // the postcodes.io bulk limit

const valid = (r: unknown): LatLng | null => {
  const o = r as { latitude?: unknown; longitude?: unknown } | null;
  if (!o || typeof o.latitude !== "number" || typeof o.longitude !== "number") return null;
  return Number.isFinite(o.latitude) && Number.isFinite(o.longitude) && inWalesBox(o.latitude, o.longitude) ? { lat: o.latitude, lng: o.longitude } : null;
};

const normalise = (p: string) => p.replace(/\s+/g, "").toUpperCase();

export const postcodesIo: Geocoder = async (postcodes) => {
  if (!postcodes.length) return new Map();
  try {
    const res = await fetch(`${BASE()}/postcodes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postcodes: postcodes.slice(0, GEO_BATCH) }),
      signal: AbortSignal.timeout(GEO_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: { query?: string; result?: unknown }[] };
    if (!Array.isArray(body.result)) return null;
    const found = new Map<string, LatLng>();
    for (const row of body.result) {
      const ll = valid(row?.result);
      if (ll && typeof row.query === "string") found.set(normalise(row.query), ll);
    }
    return found;
  } catch {
    return null;
  }
};

// Tests never reach the network unless they install their own geocoder.
let current: Geocoder = process.env.NODE_ENV === "test" ? async () => null : postcodesIo;
export function setGeocoder(g: Geocoder | null): void {
  current = g ?? (process.env.NODE_ENV === "test" ? async () => null : postcodesIo);
}

async function lookup(postcodes: string[]): Promise<Map<string, LatLng> | null> {
  try {
    const m = await current(postcodes);
    if (!m) return null;
    return new Map([...m].filter(([, v]) => inWalesBox(v.lat, v.lng)).map(([k, v]) => [normalise(k), v]));
  } catch {
    return null;
  }
}

/**
 * Called after a listing is created or edited. Awaiting it only waits for the privacy step: old coordinates are
 * cleared at once (a changed postcode or a newly hidden address must never keep a stale point). The lookup for a
 * listing that shows its address then runs in the background and its failure is ignored.
 */
export async function refreshListingGeo(prisma: PrismaClient, id: string): Promise<{ done: Promise<void> }> {
  await prisma.business.updateMany({ where: { id }, data: { lat: null, lng: null, geoSource: null } });
  const row = await prisma.business.findUnique({ where: { id }, select: { postcode: true, address: true, hideFullAddress: true } });
  if (!row || hidesAddress(row)) return { done: Promise.resolve() };
  const done = (async () => {
    const hit = (await lookup([row.postcode]))?.get(normalise(row.postcode));
    if (!hit) return;
    // The where clause re-checks the flag so an edit that hid the address in the meantime wins.
    await prisma.business.updateMany({ where: { id, hideFullAddress: false, lat: null }, data: { lat: hit.lat, lng: hit.lng, geoSource: "POSTCODE" } });
  })().catch(() => undefined);
  return { done };
}

/** For routes: waits for the clearing step only, never throws, lets the lookup finish on its own. */
export async function refreshListingGeoSoon(prisma: PrismaClient, id: string): Promise<void> {
  await refreshListingGeo(prisma, id).catch(() => undefined);
}

export type BackfillResult = { scanned: number; skippedHidden: number; updated: number; notFound: number; serviceDown: boolean };

/**
 * One-off or repeatable fill for listings with no coordinates. Hidden-address listings are skipped without ever being
 * sent out. Stops early if the service is unreachable. Safe to run again: it only touches rows whose lat is null.
 */
export async function backfillGeocodes(
  prisma: PrismaClient,
  opts: { dryRun?: boolean; limit?: number; delayMs?: number; log?: (line: string) => void } = {}
): Promise<BackfillResult> {
  const out: BackfillResult = { scanned: 0, skippedHidden: 0, updated: 0, notFound: 0, serviceDown: false };
  const limit = opts.limit ?? Infinity;
  const delay = opts.delayMs ?? 1000;
  let cursor: string | undefined;
  for (;;) {
    const rows = await prisma.business.findMany({
      where: { lat: null },
      select: { id: true, postcode: true, address: true, hideFullAddress: true },
      orderBy: { id: "asc" },
      take: GEO_BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!rows.length) break;
    cursor = rows[rows.length - 1]!.id;
    const todo = rows.filter((r) => {
      out.scanned++;
      if (hidesAddress(r)) {
        out.skippedHidden++;
        return false;
      }
      return true;
    }).slice(0, Math.max(0, limit - out.updated - out.notFound));
    if (todo.length) {
      if (opts.dryRun) out.updated += todo.length;
      else {
        const found = await lookup([...new Set(todo.map((r) => r.postcode))]);
        if (!found) {
          out.serviceDown = true;
          opts.log?.("postcodes.io did not answer, stopping. Run again later, finished rows are kept.");
          break;
        }
        for (const r of todo) {
          const hit = found.get(normalise(r.postcode));
          if (!hit) {
            out.notFound++;
            continue;
          }
          const res = await prisma.business.updateMany({
            where: { id: r.id, lat: null, hideFullAddress: false },
            data: { lat: hit.lat, lng: hit.lng, geoSource: "POSTCODE" },
          });
          out.updated += res.count;
        }
      }
    }
    if (out.updated + out.notFound >= limit || rows.length < GEO_BATCH) break;
    await new Promise((r) => setTimeout(r, delay));
  }
  return out;
}
