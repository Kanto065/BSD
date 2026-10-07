import type { PublicListItem } from "@/lib/api";

// Browser side helpers for Near Me and the map. The visitor's point lives only in component state: it is never
// stored (no localStorage, cookie or URL) and goes only to the BSD API as query parameters, which the API does not log.

export const RADIUS_CHOICES = [
  { miles: 1, label: "1 Mile" },
  { miles: 5, label: "5 Miles" },
  { miles: 10, label: "10 Miles" },
] as const;
export type Miles = (typeof RADIUS_CHOICES)[number]["miles"];
export const DEFAULT_MILES: Miles = 5;

export type Point = { lat: number; lng: number };

/** SA1 Swansea City Centre, used when GPS is denied or outside the area. Same point as the API DEFAULT_CENTRE. */
export const FALLBACK_POINT: Point = { lat: 51.6267, lng: -3.9404 };

// Postcode district centres (same values as bsd-api common/geo.ts), so a typed postcode needs no outside service.
const DISTRICTS: Record<string, [number, number]> = {
  SA1: [51.6267, -3.9404], SA2: [51.619, -3.9982], SA3: [51.5811, -4.0525], SA4: [51.6732, -4.0482],
  SA5: [51.649, -3.9712], SA6: [51.6763, -3.9225], SA7: [51.6647, -3.8881], SA8: [51.7218, -3.8477],
  SA9: [51.7814, -3.7688], SA10: [51.6879, -3.8005], SA11: [51.6749, -3.7614], SA12: [51.6082, -3.7958],
  SA13: [51.6059, -3.7249], SA14: [51.7355, -4.1062], SA15: [51.6997, -4.1679], SA16: [51.6893, -4.2576],
  SA17: [51.7565, -4.2849], SA18: [51.7978, -3.9609], SA19: [51.9549, -3.9479], SA20: [52.0118, -3.7878],
  SA31: [51.8569, -4.3084], SA32: [51.888, -4.1697], SA33: [51.8496, -4.4408], SA34: [51.852, -4.6191],
};

/** "SA5 4AB", "sa5" or "SA54AB" to the centre of that district, or null when it is not a BSD district. */
export function pointFromPostcode(input: string): Point | null {
  const t = input.toUpperCase().replace(/\s+/g, "");
  const m = /^(SA\d{1,2})(\d[A-Z]{2})?$/.exec(t);
  const c = m ? DISTRICTS[m[1]!] : undefined;
  return c ? { lat: c[0], lng: c[1] } : null;
}

export type NearFilters = { q?: string; category?: string; zone?: string };

/** Path (under the API root) for the near call. Coordinates are rounded to 3 decimals (about 100 m). */
export function nearPath(p: Point, miles: Miles, f: NearFilters = {}): string {
  const qs = new URLSearchParams({ lat: p.lat.toFixed(3), lng: p.lng.toFixed(3), miles: String(miles), pageSize: "50" });
  if (f.q) qs.set("q", f.q);
  if (f.category) qs.set("category", f.category);
  return `businesses/near?${qs.toString()}`;
}

export function pinsPath(f: NearFilters = {}): string {
  const qs = new URLSearchParams();
  if (f.zone) qs.set("zone", f.zone);
  if (f.category) qs.set("category", f.category);
  if (f.q) qs.set("q", f.q);
  const s = qs.toString();
  return s ? `businesses/map-pins?${s}` : "businesses/map-pins";
}

export type NearItem = PublicListItem & { distanceMiles: number | null; distanceApproximate: boolean };
export type NearResult = { items: NearItem[]; total: number; miles: number };
export type Pin = { geometry: { coordinates: [number, number] }; properties: { id: string; slug: string; name: string; categoryName: string; verificationStatus: string } };
export type PinCollection = { features: Pin[]; meta: { hiddenCount: number } };

/** [[south, west], [north, east]] around the pins, or null when there are none. */
export function pinsToBounds(pins: Pin[]): [[number, number], [number, number]] | null {
  if (pins.length === 0) return null;
  let s = 90, n = -90, w = 180, e = -180;
  for (const f of pins) {
    const [lng, lat] = f.geometry.coordinates;
    s = Math.min(s, lat); n = Math.max(n, lat); w = Math.min(w, lng); e = Math.max(e, lng);
  }
  return [[s, w], [n, e]];
}

export const hiddenLine = (n: number) =>
  `${n} ${n === 1 ? "business hides" : "businesses hide"} their exact location and ${n === 1 ? "is" : "are"} only in the list`;
export const distanceLabel = (m: number | null) => (m === null ? null : `${m.toFixed(1)} mi`);

export const PIN_COLOURS: Record<string, string> = { COMMUNITY_VERIFIED: "#15803d", PENDING_VERIFICATION: "#b45309", NEWLY_LISTED: "#2563eb" };
