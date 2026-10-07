import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { startTestDb, type TestDb } from "./helpers/testdb.js";
import { MemoryStorage } from "../src/common/storage.js";
import { hashPassword } from "../src/common/passwords.js";
import { backfillGeocodes, refreshListingGeo, setGeocoder, type Geocoder } from "../src/common/geocode.js";

// M10-B: Near Me and map pins. A listing that hides its address is never drawn, never given a distance, and its
// precise place and full postcode appear in no public body.

vi.setConfig({ testTimeout: 60_000, hookTimeout: 240_000 });
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-hs256-signing";

let t: TestDb;
let prisma: PrismaClient;
let app: FastifyInstance;
let adminToken = "";
let n = 0;

const PASSWORD = "Correct-Horse-Battery-77";
const SECRET_STREET = "9 Hidden Row";
const SECRET_POSTCODE = "SA1 9ZZ";
const SECRET_LAT = 51.61234567;
const SECRET_LNG = -3.91234567;
const SWANSEA = "lat=51.6267&lng=-3.9404";
const words = (k: number) => Array.from({ length: k }, (_, i) => `word${i}`).join(" ");

async function get(url: string) {
  const res = await app.inject({ method: "GET", url });
  return { status: res.statusCode, text: res.body, body: res.body ? JSON.parse(res.body) : null, headers: res.headers };
}

async function make(name: string, over: Record<string, unknown> = {}) {
  const zone = await prisma.coverageZone.findUniqueOrThrow({ where: { slug: "zone-1" } });
  const category = await prisma.category.findFirstOrThrow({ where: { status: "APPROVED", requiresOwnerName: false }, orderBy: { slug: "asc" } });
  return prisma.business.create({
    data: {
      slug: `near-${++n}`,
      name,
      categoryId: category.id,
      description: `We run a small shop and serve the neighbourhood every day. ${words(30)}`,
      servicesOffered: ["Bread"],
      phone: "01792 123 456",
      address: "1 High Street",
      postcode: "SA1 4PE",
      postcodeDistrict: "SA1",
      zoneId: zone.id,
      otherAreaText: "Around Swansea",
      status: "APPROVED",
      ...over,
    },
  });
}

beforeAll(async () => {
  t = await startTestDb();
  process.env.DATABASE_URL = t.url;
  const { PrismaClient: Client } = await import("@prisma/client");
  prisma = new Client({ datasources: { db: { url: t.url } } });
  delete process.env.SEED_ADMIN_EMAIL;
  const { runSeed } = await import("../prisma/seed.js");
  await runSeed(prisma);
  await prisma.adminUser.create({ data: { name: "Admin", email: "admin@test.example", role: "ADMIN", passwordHash: await hashPassword(PASSWORD) } });
  const { buildApp } = (await import("../src/server.js")) as { buildApp: (o: { storage: MemoryStorage }) => FastifyInstance };
  app = buildApp({ storage: new MemoryStorage() });
  await app.ready();
  const login = await app.inject({ method: "POST", url: "/admin/login", payload: { email: "admin@test.example", password: PASSWORD } });
  adminToken = JSON.parse(login.body).accessToken;

  await make("Near Alpha", { lat: 51.6267, lng: -3.9404, geoSource: "POSTCODE" }); // at the point
  await make("Near Bravo", { lat: 51.64, lng: -3.94, geoSource: "POSTCODE" }); // about 0.9 miles north
  await make("Near Charlie", { lat: 51.7, lng: -4.168, geoSource: "POSTCODE", postcodeDistrict: "SA15" }); // about 11 miles west
  await make("Near Delta Unlocated", { postcodeDistrict: "SA1" }); // shows its address, no point yet
  await make("Near Echo Hidden", { hideFullAddress: true, address: SECRET_STREET, postcode: SECRET_POSTCODE });
  // A hidden listing that somehow still holds a point (a bug elsewhere) must still be handled as hidden.
  await make("Near Foxtrot HomeBased", { address: "HomeBased", lat: SECRET_LAT, lng: SECRET_LNG, geoSource: "POSTCODE", postcode: SECRET_POSTCODE });
  await make("Near Golf Pending", { status: "PENDING", lat: 51.6267, lng: -3.9404 });
  const staged = await prisma.category.create({ data: { name: "Near Staged", slug: "near-staged", status: "PENDING", sortOrder: 99 } });
  await make("Near Hotel Staged Category", { categoryId: staged.id, lat: 51.6267, lng: -3.9404 });
});

afterEach(() => setGeocoder(null));

afterAll(async () => {
  await app?.close();
  await prisma?.$disconnect();
  await t?.stop();
});

const names = (r: { body: { items: { name: string }[] } }) => r.body.items.map((i) => i.name);

describe("GET /businesses/near", () => {
  it("returns listings in range nearest first with rounded distances", async () => {
    const r = await get(`/businesses/near?${SWANSEA}&miles=5`);
    expect(r.status).toBe(200);
    expect(names(r)[0]).toBe("Near Alpha");
    expect(names(r).filter((x) => !x.includes("Foxtrot") && !x.includes("Echo")).sort()).toEqual(["Near Alpha", "Near Bravo", "Near Delta Unlocated"]);
    const dists = r.body.items.map((i: { distanceMiles: number | null }) => i.distanceMiles).filter((d: number | null) => d !== null);
    expect([...dists].sort((a: number, b: number) => a - b)).toEqual(dists);
    const alpha = r.body.items[0];
    expect(alpha.distanceMiles).toBe(0);
    expect(alpha.distanceApproximate).toBe(false);
    const bravo = r.body.items.find((i: { name: string }) => i.name === "Near Bravo");
    expect(bravo.distanceMiles).toBeGreaterThan(0.8);
    expect(bravo.distanceMiles).toBeLessThan(1.0);
    expect(r.headers["set-cookie"]).toBeUndefined();
  });

  it("1 mile returns fewer than 10 miles and the radius edge is respected", async () => {
    const one = await get(`/businesses/near?${SWANSEA}&miles=1`);
    const ten = await get(`/businesses/near?${SWANSEA}&miles=10`);
    expect(names(one)).toContain("Near Bravo");
    expect(names(one)).not.toContain("Near Charlie");
    expect(ten.body.total).toBeGreaterThanOrEqual(one.body.total);
    // Charlie is 10.9 miles away: out of 10, in nothing smaller
    expect(names(ten)).not.toContain("Near Charlie");
  });

  it("hidden listings are ranked by district, carry no distance, and never leak their point or postcode", async () => {
    for (const url of [`/businesses/near?${SWANSEA}&miles=10`, `/businesses/near?${SWANSEA}&miles=1`, `/businesses/map-pins`]) {
      const r = await get(url);
      expect(r.text, url).not.toContain(SECRET_STREET);
      expect(r.text, url).not.toContain(SECRET_POSTCODE);
      expect(r.text, url).not.toContain("51.61234");
      expect(r.text, url).not.toContain("-3.91234");
      expect(r.text, url).not.toContain('"lat"');
    }
    const r = await get(`/businesses/near?${SWANSEA}&miles=5`);
    for (const name of ["Near Echo Hidden", "Near Foxtrot HomeBased"]) {
      const item = r.body.items.find((i: { name: string }) => i.name === name);
      expect(item, name).toBeTruthy();
      expect(item.distanceMiles).toBeNull();
      expect(item.distanceApproximate).toBe(true);
      expect(item.postcode).toBeNull();
      expect(item.address).toBeNull();
      expect(item.areaLabel).toBe("SA1");
    }
    // a shown address without a stored point gets a district level distance, flagged approximate
    const delta = r.body.items.find((i: { name: string }) => i.name === "Near Delta Unlocated");
    expect(delta.distanceApproximate).toBe(true);
    expect(typeof delta.distanceMiles).toBe("number");
  });

  it("excludes pending listings and listings in a staged category", async () => {
    const r = await get(`/businesses/near?${SWANSEA}&miles=10&pageSize=50`);
    expect(names(r).some((x) => x.includes("Pending") || x.includes("Staged"))).toBe(false);
  });

  it("category and q filters compose, and paging works", async () => {
    const cat = await prisma.category.findFirstOrThrow({ where: { status: "APPROVED", requiresOwnerName: false }, orderBy: { slug: "asc" } });
    const filtered = await get(`/businesses/near?${SWANSEA}&miles=5&category=${cat.slug}&q=Bravo`);
    expect(names(filtered)).toEqual(["Near Bravo"]);
    const other = await get(`/businesses/near?${SWANSEA}&miles=5&category=no-such-category`);
    expect(other.body.total).toBe(0);
    const p1 = await get(`/businesses/near?${SWANSEA}&miles=5&pageSize=1&page=1`);
    const p2 = await get(`/businesses/near?${SWANSEA}&miles=5&pageSize=1&page=2`);
    expect(p1.body.totalPages).toBe(p1.body.total);
    expect(names(p1)[0]).not.toBe(names(p2)[0]);
  });

  it("validates lat, lng and miles, and refuses points outside the area", async () => {
    expect((await get(`/businesses/near?lat=91&lng=0`)).status).toBe(400);
    expect((await get(`/businesses/near?lat=abc&lng=0`)).status).toBe(400);
    expect((await get(`/businesses/near?lat=51.6`)).status).toBe(400);
    expect((await get(`/businesses/near?${SWANSEA}&miles=7`)).status).toBe(400);
    expect((await get(`/businesses/near?lat=Infinity&lng=0`)).status).toBe(400);
    const far = await get(`/businesses/near?lat=51.5074&lng=-0.1278`); // London
    expect(far.status).toBe(400);
    expect(far.body).toEqual({ error: "Near Me works inside the BSD area." });
  });

  it("is not shadowed by the slug route and sends no cache", async () => {
    const r = await get(`/businesses/near?${SWANSEA}`);
    expect(r.status).toBe(200);
    expect(r.headers["cache-control"]).toBe("no-store");
  });
});

describe("GET /businesses/map-pins", () => {
  it("returns GeoJSON for shown, located, public listings only, with a 60 second cache", async () => {
    const r = await get("/businesses/map-pins");
    expect(r.status).toBe(200);
    expect(r.headers["cache-control"]).toBe("public, max-age=60");
    expect(r.headers["set-cookie"]).toBeUndefined();
    expect(r.body.type).toBe("FeatureCollection");
    const pinned = r.body.features.map((f: { properties: { name: string } }) => f.properties.name).sort();
    expect(pinned).toEqual(["Near Alpha", "Near Bravo", "Near Charlie"]);
    const f = r.body.features.find((x: { properties: { name: string } }) => x.properties.name === "Near Alpha");
    expect(f.geometry).toEqual({ type: "Point", coordinates: [-3.9404, 51.6267] });
    expect(Object.keys(f.properties).sort()).toEqual(["categoryName", "id", "name", "slug", "verificationStatus"]);
    // Echo and Foxtrot hide their address: counted, not drawn
    expect(r.body.meta.hiddenCount).toBe(2);
  });

  it("filters by zone, category and q, and rejects bad filters", async () => {
    const cat = await prisma.category.findFirstOrThrow({ where: { status: "APPROVED", requiresOwnerName: false }, orderBy: { slug: "asc" } });
    expect((await get(`/businesses/map-pins?q=Bravo&category=${cat.slug}&zone=zone-1`)).body.features).toHaveLength(1);
    expect((await get("/businesses/map-pins?zone=zone-2")).body.features).toHaveLength(0);
    expect((await get("/businesses/map-pins?zone=BAD%20SLUG!")).status).toBe(400);
  });

  it("caps the response at 500 points", async () => {
    const zone = await prisma.coverageZone.findUniqueOrThrow({ where: { slug: "zone-1" } });
    const cat = await prisma.category.findFirstOrThrow({ where: { status: "APPROVED", requiresOwnerName: false } });
    await prisma.business.createMany({
      data: Array.from({ length: 510 }, (_, i) => ({
        slug: `bulk-${i}`,
        name: `Bulk ${i}`,
        categoryId: cat.id,
        description: "x",
        servicesOffered: ["x"],
        phone: "1",
        address: "1 Road",
        postcode: "SA1 1AA",
        postcodeDistrict: "SA1",
        zoneId: zone.id,
        status: "APPROVED" as const,
        lat: 51.6,
        lng: -3.9,
      })),
    });
    const r = await get("/businesses/map-pins");
    expect(r.body.features).toHaveLength(500);
    await prisma.business.deleteMany({ where: { slug: { startsWith: "bulk-" } } });
  });
});

describe("existing routes are unchanged", () => {
  it("search and the detail route still work and do not expose coordinates", async () => {
    const s = await get("/businesses/search?q=Near+Alpha");
    expect(s.status).toBe(200);
    expect(s.text).not.toContain("51.6267");
    const slug = s.body.items[0].slug;
    const d = await get(`/businesses/${slug}`);
    expect(d.status).toBe(200);
    expect(d.text).not.toContain("51.6267");
    expect(d.text).not.toContain("geoSource");
  });
});

const fake = (table: Record<string, { lat: number; lng: number }>): Geocoder => async (pcs) =>
  new Map(pcs.filter((p) => table[p.replace(/\s/g, "")]).map((p) => [p, table[p.replace(/\s/g, "")]!]));

describe("geocoding", () => {
  it("fills a shown address, clears and never looks up a hidden one", async () => {
    const calls: string[][] = [];
    setGeocoder(async (p) => (calls.push(p), new Map(p.map((x) => [x, { lat: 51.62, lng: -3.94 }]))));
    const shown = await make("Geo Shown");
    await (await refreshListingGeo(prisma, shown.id)).done;
    expect(await prisma.business.findUnique({ where: { id: shown.id }, select: { lat: true, lng: true, geoSource: true } })).toEqual({ lat: 51.62, lng: -3.94, geoSource: "POSTCODE" });
    expect(calls).toEqual([["SA1 4PE"]]);

    const hidden = await make("Geo Hidden", { hideFullAddress: true, lat: 51.6, lng: -3.9, geoSource: "POSTCODE" });
    await (await refreshListingGeo(prisma, hidden.id)).done;
    expect(await prisma.business.findUnique({ where: { id: hidden.id }, select: { lat: true, lng: true, geoSource: true } })).toEqual({ lat: null, lng: null, geoSource: null });
    expect(calls).toHaveLength(1); // the hidden postcode was never sent
  });

  it("fails soft: a throwing, null or out-of-area answer leaves the listing without a point and does not throw", async () => {
    const b = await make("Geo Soft");
    for (const g of [async () => { throw new Error("network down"); }, async () => null, async () => new Map([["SA1 4PE", { lat: 10, lng: 10 }]])] as Geocoder[]) {
      setGeocoder(g);
      await (await refreshListingGeo(prisma, b.id)).done;
      const row = await prisma.business.findUniqueOrThrow({ where: { id: b.id } });
      expect(row.lat === null || (row.lat > 51 && row.lat < 53)).toBe(true);
    }
  });

  it("an admin edit of the postcode or the hide switch re-decides the point and audits only the real fields", async () => {
    setGeocoder(fake({ SA24XX: { lat: 51.65, lng: -3.97 } }));
    const b = await make("Geo Admin", { lat: 51.6, lng: -3.9, geoSource: "POSTCODE" });
    const patch = (payload: object) =>
      app.inject({ method: "PATCH", url: `/admin/listings/${b.id}`, payload, headers: { authorization: `Bearer ${adminToken}` } });
    expect((await patch({ hideFullAddress: true })).statusCode).toBe(200);
    expect(await prisma.business.findUnique({ where: { id: b.id }, select: { lat: true, lng: true } })).toEqual({ lat: null, lng: null });
    expect((await patch({ hideFullAddress: false, postcode: "SA2 4XX" })).statusCode).toBe(200);
    // the lookup runs in the background, give it a moment
    await vi.waitFor(async () => {
      const row = await prisma.business.findUniqueOrThrow({ where: { id: b.id }, select: { lat: true } });
      expect(row.lat).toBe(51.65);
    });
    const logs = await prisma.auditLog.findMany({ where: { entityId: b.id } });
    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(logs)).not.toContain("51.65");
    expect((await app.inject({ method: "PATCH", url: `/admin/listings/${b.id}`, payload: { postcode: "SA2 4XX" } })).statusCode).toBe(401);
  });

  it("the backfill is idempotent, skips hidden listings without sending them, and stops when the service is down", async () => {
    await prisma.business.updateMany({ data: { lat: null, lng: null, geoSource: null } });
    const sent: string[] = [];
    setGeocoder(async (p) => (sent.push(...p), new Map(p.filter((x) => x === "SA1 4PE").map((x) => [x, { lat: 51.63, lng: -3.94 }]))));
    const dry = await backfillGeocodes(prisma, { dryRun: true, delayMs: 0 });
    expect(dry.updated).toBeGreaterThan(0);
    expect(sent).toHaveLength(0);
    expect(await prisma.business.count({ where: { lat: { not: null } } })).toBe(0);

    const first = await backfillGeocodes(prisma, { delayMs: 0 });
    expect(first.skippedHidden).toBeGreaterThanOrEqual(2);
    expect(first.updated).toBeGreaterThan(0);
    expect(sent).not.toContain(SECRET_POSTCODE);
    expect(await prisma.business.count({ where: { lat: { not: null }, OR: [{ hideFullAddress: true }, { address: "HomeBased" }] } })).toBe(0);

    const before = sent.length;
    const second = await backfillGeocodes(prisma, { delayMs: 0 });
    expect(second.updated).toBe(0); // everything findable is already done
    expect(sent.length).toBeGreaterThanOrEqual(before);

    await prisma.business.updateMany({ data: { lat: null, lng: null, geoSource: null } });
    setGeocoder(async () => null);
    const down = await backfillGeocodes(prisma, { delayMs: 0 });
    expect(down.serviceDown).toBe(true);
    expect(down.updated).toBe(0);
  });
});
