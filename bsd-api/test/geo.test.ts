import { describe, it, expect, vi } from "vitest";
import { postcodesIo } from "../src/common/geocode.js";
import { DISTRICT_CENTRES, bboxFor, districtsWithin, haversineMiles, inWalesBox, roundMiles } from "../src/common/geo.js";
import { redactedRequest } from "../src/common/logging.js";
import { ZONES } from "../prisma/seed-data.js";

describe("geo helpers", () => {
  it("haversine matches known distances", () => {
    expect(haversineMiles(51.5, -3, 51.5, -3)).toBe(0);
    // Swansea (SA1 centre) to Llanelli (SA15 centre) is about 11 miles by air
    const d = haversineMiles(...DISTRICT_CENTRES.SA1!, ...DISTRICT_CENTRES.SA15!);
    expect(d).toBeGreaterThan(10);
    expect(d).toBeLessThan(12);
    // one degree of latitude is about 69 miles
    expect(haversineMiles(51, -3, 52, -3)).toBeCloseTo(69.1, 0);
  });

  it("bboxFor spans the radius", () => {
    const [lat, lng] = DISTRICT_CENTRES.SA1!;
    const box = bboxFor(lat, lng, 5);
    expect(box.minLat).toBeLessThan(lat);
    expect(box.maxLng).toBeGreaterThan(lng);
    expect(box.maxLat - lat).toBeCloseTo(5 / 69.09, 2);
  });

  it("the centre table is exactly the districts used by the zones", () => {
    const fromZones = ZONES.flatMap((z) => z.postcodeDistricts).sort();
    expect(Object.keys(DISTRICT_CENTRES).sort()).toEqual(fromZones);
    for (const [lat, lng] of Object.values(DISTRICT_CENTRES)) expect(inWalesBox(lat, lng)).toBe(true);
  });

  it("districtsWithin and roundMiles", () => {
    const [lat, lng] = DISTRICT_CENTRES.SA1!;
    expect(districtsWithin(lat, lng, 1)).toEqual(["SA1"]);
    expect(districtsWithin(lat, lng, 10).length).toBeGreaterThan(3);
    expect(roundMiles(1.2345)).toBe(1.2);
  });

  it("postcodes.io client parses a bulk reply, rejects points outside Wales, and fails soft", async () => {
    const ok = { result: [{ query: "SA1 4PE", result: { latitude: 51.62, longitude: -3.94 } }, { query: "SA1 1ZZ", result: null }, { query: "SA2 1AA", result: { latitude: 10, longitude: 10 } }] };
    vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => ok }));
    const found = await postcodesIo(["SA1 4PE", "SA1 1ZZ", "SA2 1AA"]);
    expect([...found!.keys()]).toEqual(["SA14PE"]);
    vi.stubGlobal("fetch", async () => { throw new Error("offline"); });
    expect(await postcodesIo(["SA1 4PE"])).toBeNull();
    vi.stubGlobal("fetch", async () => ({ ok: false, json: async () => ({}) }));
    expect(await postcodesIo(["SA1 4PE"])).toBeNull();
    vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => ({ nonsense: true }) }));
    expect(await postcodesIo(["SA1 4PE"])).toBeNull();
    vi.unstubAllGlobals();
  });

  it("the request logger drops the visitor point with the rest of the query string", () => {
    const r = redactedRequest({ method: "GET", url: "/businesses/near?lat=51.62&lng=-3.94&miles=5", ip: "1.2.3.4" });
    expect(r.url).toBe("/businesses/near");
    expect(JSON.stringify(r)).not.toContain("51.62");
  });
});
