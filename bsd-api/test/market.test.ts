import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { startTestDb, type TestDb } from "./helpers/testdb.js";
import { MemoryStorage } from "../src/common/storage.js";
import { call, makeMember, noisyJpeg, post, VALID } from "./helpers/market.js";

vi.setConfig({ testTimeout: 90_000, hookTimeout: 240_000 });
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-hs256-signing";

let t: TestDb;
let prisma: PrismaClient;
let app: FastifyInstance;
let storage: MemoryStorage;
let n = 0;
let jpeg: Buffer;

const CATEGORIES = [
  "Buy & Sell", "B2B Equipment", "Home Cooks & Halal Goods", "Vehicles", "Cultural Goods", "Give Away",
  "Wanted Items / Gigs", "Housing & Accommodation", "Jobs & Opportunities", "Local Services", "Student Essentials",
];

beforeAll(async () => {
  t = await startTestDb();
  process.env.DATABASE_URL = t.url;
  const { PrismaClient: Client } = await import("@prisma/client");
  prisma = new Client({ datasources: { db: { url: t.url } } });
  delete process.env.SEED_ADMIN_EMAIL;
  await (await import("../prisma/seed.js")).runSeed(prisma);
  storage = new MemoryStorage();
  const { buildApp } = await import("../src/server.js");
  app = buildApp({ storage });
  await app.ready();
  jpeg = await noisyJpeg(900, 700);
});
afterAll(async () => {
  await app?.close();
  await prisma?.$disconnect();
  await t?.stop();
});

/** A member whose first two listings are already used up, so the next one is instant. */
async function seasoned(label: string) {
  const m = await makeMember(prisma, `${label}${++n}`);
  const cat = await prisma.marketCategory.findFirstOrThrow({ where: { slug: "buy-and-sell" } });
  for (let i = 0; i < 2; i++) {
    await prisma.marketListing.create({
      data: {
        slug: `old-${m.id}-${i}`, ownerUserId: m.id, kind: "SELL", title: "Old one", description: "x".repeat(30), categoryId: cat.id,
        postcode: "SA1 4PE", postcodeDistrict: "SA1", whatsapp: "07700900123", status: "ARCHIVED", expiresAt: new Date(Date.now() - 1000),
        createdAt: new Date(Date.now() - 3 * 86400_000), bumpedAt: new Date(Date.now() - 3 * 86400_000),
      },
    });
  }
  return m;
}

describe("categories", () => {
  it("seeds exactly the client's 11 names, and the public list hides the staged Housing and Jobs", async () => {
    const all = await prisma.marketCategory.findMany({ orderBy: { sortOrder: "asc" } });
    expect(all.map((c) => c.name)).toEqual(CATEGORIES);
    expect(all.filter((c) => c.staged).map((c) => c.name)).toEqual(["Housing & Accommodation", "Jobs & Opportunities"]);
    const res = await call(app, "GET", "/market/categories");
    expect(res.body.categories).toHaveLength(9);
    expect(res.text).not.toContain("Housing");
  });
});

describe("create", () => {
  it("needs a signed in member who joined the Marketplace", async () => {
    expect((await post(app, undefined, VALID)).status).toBe(401);
    const noModule = await makeMember(prisma, `nomod${++n}`, null);
    const res = await post(app, noModule.cookie, VALID);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Join the Marketplace to use this.");
  });

  it("holds the first two listings (PENDING, not public), then publishes instantly", async () => {
    const m = await makeMember(prisma, `new${++n}`);
    const a = await post(app, m.cookie, VALID);
    expect(a.status).toBe(201);
    expect(a.body.listing.status).toBe("PENDING");
    expect(a.body.held).toBe(true);
    const slugA = a.body.listing.slug;
    expect((await call(app, "GET", `/market/listings/${slugA}`)).status).toBe(404);
    expect((await call(app, "GET", "/market/listings")).text).not.toContain(slugA);
    expect((await post(app, m.cookie, VALID)).body.listing.status).toBe("PENDING");
    const third = await post(app, m.cookie, { ...VALID, title: "Third listing here" });
    expect(third.body.listing.status).toBe("ACTIVE");
    expect((await call(app, "GET", `/market/listings/${third.body.listing.slug}`)).status).toBe(200);
    expect((await call(app, "GET", "/market/listings")).text).toContain(third.body.listing.slug);
  });

  it("validates fields on the server", async () => {
    const m = await seasoned("val");
    const bad = async (over: Record<string, string>, field: string) => {
      const r = await post(app, m.cookie, { ...VALID, ...over });
      expect(r.status, field).toBe(400);
      expect(r.body.fieldErrors[field], field).toBeTruthy();
    };
    await bad({ title: "abc" }, "title");
    await bad({ description: "too short" }, "description");
    await bad({ legalAcknowledged: "false" }, "legalAcknowledged");
    await bad({ whatsapp: "" }, "whatsapp");
    await bad({ postcode: "CF10 1AA" }, "postcode");
    await bad({ postcode: "nonsense" }, "postcode");
    await bad({ category: "no-such" }, "category");
    await bad({ category: "housing-and-accommodation" }, "category");
    await bad({ category: "jobs-and-opportunities" }, "category");
    await bad({ price: "1000000.01" }, "price");
    await bad({ price: "" }, "price");
    await bad({ vatInvoice: "true" }, "isB2B");
    await bad({ spotId: "nope" }, "spotId");
    await bad({ kind: "HOUSING" }, "kind");
  });

  it("a giveaway has no price whatever is sent, and B2B fields work for B2B", async () => {
    const m = await seasoned("give");
    const g = await post(app, m.cookie, { ...VALID, kind: "GIVEAWAY", price: "30" });
    expect(g.body.listing.pricePence).toBeNull();
    expect(g.body.listing.free).toBe(true);
    const b = await post(app, m.cookie, { ...VALID, isB2B: "true", vatInvoice: "true", bulkTerms: "Min 10 units", price: "0" });
    expect(b.status).toBe(201);
    expect(b.body.listing.vatInvoice).toBe(true);
    expect(b.body.listing.pricePence).toBe(0);
    expect(b.body.listing.hideFullAddress).toBe(false); // B2B is not hidden by default
  });

  it("strips tags from text and stores the price in pence", async () => {
    const m = await seasoned("clean");
    const r = await post(app, m.cookie, { ...VALID, title: "Bike <script>alert(1)</script> sale" });
    expect(r.body.listing.title).not.toContain("<");
    expect(r.body.listing.pricePence).toBe(4550);
  });

  it("limits a member to 5 new listings in 24 hours", async () => {
    const m = await seasoned("rate");
    for (let i = 0; i < 5; i++) expect((await post(app, m.cookie, VALID)).status).toBe(201);
    expect((await post(app, m.cookie, VALID)).status).toBe(429);
  });

  it("accepts up to 5 images as shrunk WebP under public keys, refuses a 6th, a PDF and a disguised file", async () => {
    const m = await seasoned("img");
    const file = (name = "a.jpg") => ({ name, type: "image/jpeg", body: jpeg });
    const ok = await post(app, m.cookie, VALID, [file(), file("b.jpg")]);
    expect(ok.status).toBe(201);
    expect(ok.body.listing.images).toHaveLength(2);
    expect(ok.body.listing.images[0].url).toMatch(/^\/uploads\/market\//);
    const before = storage.objects.size;
    expect(before).toBeGreaterThanOrEqual(4);
    for (const body of storage.objects.values()) expect(body.contentType).toBe("image/webp");
    expect(storage.privateObjects.size).toBe(0);

    const six = await post(app, m.cookie, VALID, Array.from({ length: 6 }, (_, i) => file(`${i}.jpg`)));
    expect(six.status).toBe(400);
    const pdf = await post(app, m.cookie, VALID, [{ name: "x.jpg", type: "image/jpeg", body: Buffer.from("%PDF-1.4 fake") }]);
    expect(pdf.status).toBe(400);
    expect(pdf.body.fieldErrors.images).toBeTruthy();
    expect(storage.objects.size).toBe(before); // nothing stored for the failed ones
  });

  it("refuses uploads when storage is not configured", async () => {
    const { buildApp } = await import("../src/server.js");
    const bare = buildApp({ storage: null });
    await bare.ready();
    const m = await seasoned("nostore");
    const r = await post(bare, m.cookie, VALID, [{ name: "a.jpg", type: "image/jpeg", body: jpeg }]);
    expect(r.status).toBe(503);
    await bare.close();
  });

  it("shows the BSD Verified Business badge when the seller owns an approved directory listing", async () => {
    const m = await seasoned("biz");
    const zone = await prisma.coverageZone.findFirstOrThrow();
    const cat = await prisma.category.findFirstOrThrow({ where: { status: "APPROVED" } });
    const biz = await prisma.business.create({
      data: {
        slug: `m12-biz-${n}`, name: "Seller Shop", categoryId: cat.id, description: "d".repeat(160), servicesOffered: ["x"], phone: "01792123456",
        address: "1 Road", postcode: "SA1 4PE", postcodeDistrict: "SA1", zoneId: zone.id, ownerUserId: m.id, status: "APPROVED",
        consentAccurateInfo: true, consentPublishPermission: true, consentNoLiability: true, consentDataStorage: true, gdprConsentStorage: true, gdprConsentRights: true,
      },
    });
    const r = await post(app, m.cookie, VALID);
    expect(r.body.listing.verifiedBusiness).toEqual({ name: "Seller Shop", slug: biz.slug });
  });
});

describe("hidden address", () => {
  it("never leaks the full postcode in any public body, and is hidden by default for private sellers", async () => {
    const m = await seasoned("hide");
    const spot = await prisma.safeSpot.create({ data: { name: "Library front", address: "Alexandra Road", postcodeDistrict: "SA1" } });
    const r = await post(app, m.cookie, { ...VALID, postcode: "SA5 4AB", spotId: spot.id });
    expect(r.body.listing.hideFullAddress).toBe(true);
    const slug = r.body.listing.slug;
    const urls = [`/market/listings/${slug}`, "/market/listings", "/market/listings?district=SA5", "/market/listings?q=bicycle", `/market/listings/${slug}/contact`, "/market/spots", "/market/categories"];
    for (const url of urls) {
      const res = await call(app, "GET", url);
      expect(res.text, url).not.toMatch(/4AB/i);
      expect(res.text, url).not.toMatch(/SA5\s?4/i);
    }
    const detail = await call(app, "GET", `/market/listings/${slug}`);
    expect(detail.body.postcode).toBeNull();
    expect(detail.body.areaLabel).toBe("Location: SA5");
    expect(detail.body.postcodeDistrict).toBe("SA5");
    expect(detail.text).not.toContain("ownerUserId");
    expect(typeof detail.body.id).toBe("string"); // the web needs it for Save and Report
    expect(detail.text).not.toMatch(/4AB/i);
    // The owner still sees it.
    expect((await call(app, "GET", "/market/mine", { cookie: m.cookie })).text).toContain("SA5 4AB");
    // Ticking it off shows the postcode.
    const open = await post(app, m.cookie, { ...VALID, postcode: "SA5 4AB", hideFullAddress: "false" });
    expect((await call(app, "GET", `/market/listings/${open.body.listing.slug}`)).body.postcode).toBe("SA5 4AB");
  });
});

describe("list filters", () => {
  it("filters by kind, category, district, free, b2b and text, newest bumped first, ACTIVE only", async () => {
    const m = await seasoned("filt");
    await post(app, m.cookie, { ...VALID, title: "Zebra lamp unique1", category: "vehicles", postcode: "SA2 0AA" });
    await post(app, m.cookie, { ...VALID, title: "Free sofa unique2", kind: "GIVEAWAY", category: "give-away" });
    await post(app, m.cookie, { ...VALID, title: "Oven for cafes unique3", isB2B: "true", category: "b2b-equipment" });
    const titles = async (qs: string) => (await call(app, "GET", `/market/listings?${qs}`)).body.items.map((i: { title: string }) => i.title);
    expect(await titles("q=unique1")).toEqual(["Zebra lamp unique1"]);
    expect(await titles("category=vehicles&q=unique")).toEqual(["Zebra lamp unique1"]);
    expect(await titles("district=SA2&q=unique")).toEqual(["Zebra lamp unique1"]);
    expect(await titles("free=true&q=unique")).toEqual(["Free sofa unique2"]);
    expect(await titles("kind=GIVEAWAY&q=unique")).toEqual(["Free sofa unique2"]);
    expect(await titles("b2b=true&q=unique")).toEqual(["Oven for cafes unique3"]);
    expect(await titles("q=unique")).toEqual(["Oven for cafes unique3", "Free sofa unique2", "Zebra lamp unique1"]);
    expect((await call(app, "GET", "/market/listings?page=0")).status).toBe(400);
    expect((await call(app, "GET", "/market/listings?kind=HOUSING")).status).toBe(400);
  });
});

describe("owner routes", () => {
  it("only the owner can edit or change status, others get 404", async () => {
    const owner = await seasoned("own");
    const other = await seasoned("oth");
    const id = (await post(app, owner.cookie, VALID)).body.listing.id as string;
    for (const [method, url] of [
      ["PATCH", `/market/listings/${id}`], ["POST", `/market/listings/${id}/sold`], ["POST", `/market/listings/${id}/reserve`],
      ["POST", `/market/listings/${id}/archive`], ["POST", `/market/listings/${id}/relist`], ["DELETE", `/market/listings/${id}`],
    ] as const) {
      const res = await call(app, method, url, { cookie: other.cookie, body: method === "PATCH" ? { title: "Hijacked title" } : undefined });
      expect(res.status, url).toBe(404);
    }
    expect((await prisma.marketListing.findUniqueOrThrow({ where: { id } })).title).toBe("Blue bicycle for sale");
    expect((await call(app, "GET", "/market/mine", { cookie: other.cookie })).text).not.toContain(id);
    const ok = await call(app, "PATCH", `/market/listings/${id}`, { cookie: owner.cookie, body: { title: "Red bicycle for sale", price: 20 } });
    expect(ok.status).toBe(200);
    expect(ok.body.listing.title).toBe("Red bicycle for sale");
    expect(ok.body.listing.pricePence).toBe(2000);
    expect((await call(app, "PATCH", `/market/listings/${id}`, { cookie: owner.cookie, body: { status: "ACTIVE" } })).status).toBe(400);
    expect((await call(app, "PATCH", `/market/listings/${id}`, { cookie: owner.cookie, body: { postcode: "SA9 9ZZ" } })).status).toBe(400);
    expect((await call(app, "PATCH", `/market/listings/${id}`, { cookie: owner.cookie, body: { vatInvoice: true } })).status).toBe(400);
  });

  it("walks the lifecycle: reserve, archive, relist (once a day), sold, delete", async () => {
    const m = await seasoned("life");
    const first = (await post(app, m.cookie, VALID)).body.listing;
    const id = first.id as string;
    const act = (a: string) => call(app, "POST", `/market/listings/${id}/${a}`, { cookie: m.cookie });
    expect((await act("reserve")).body.listing.status).toBe("RESERVED");
    expect((await act("reserve")).status).toBe(409);
    expect((await call(app, "GET", "/market/listings")).text).not.toContain(first.slug); // the list is ACTIVE only
    expect((await call(app, "GET", `/market/listings/${first.slug}`)).status).toBe(200);
    expect((await act("archive")).body.listing.status).toBe("ARCHIVED");
    expect((await call(app, "GET", `/market/listings/${first.slug}`)).status).toBe(404);
    expect((await act("relist")).status).toBe(429); // bumped less than 24 hours ago
    await prisma.marketListing.update({ where: { id }, data: { bumpedAt: new Date(Date.now() - 2 * 86400_000) } });
    const relisted = (await act("relist")).body.listing;
    expect(relisted.status).toBe("ACTIVE");
    expect(new Date(relisted.expiresAt).getTime()).toBeGreaterThan(Date.now() + 29 * 86400_000);
    expect((await act("sold")).body.listing.status).toBe("SOLD");
    expect((await act("relist")).status).toBe(409);
    expect((await call(app, "GET", `/market/listings/${first.slug}`)).status).toBe(200); // sold stays visible
    expect((await call(app, "DELETE", `/market/listings/${id}`, { cookie: m.cookie })).status).toBe(200);
    expect(await prisma.marketListing.count({ where: { id } })).toBe(0);
  });

  it("a held or removed listing cannot be moved by its owner, so moderation is not bypassed", async () => {
    const m = await makeMember(prisma, `held${++n}`);
    const held = (await post(app, m.cookie, VALID)).body.listing;
    for (const a of ["sold", "reserve", "archive", "relist"]) {
      expect((await call(app, "POST", `/market/listings/${held.id}/${a}`, { cookie: m.cookie })).status, a).toBe(409);
    }
    await prisma.marketListing.update({ where: { id: held.id }, data: { status: "REMOVED", removalReason: "Not allowed" } });
    expect((await call(app, "POST", `/market/listings/${held.id}/relist`, { cookie: m.cookie })).status).toBe(409);
    expect((await call(app, "PATCH", `/market/listings/${held.id}`, { cookie: m.cookie, body: { title: "Edited title now" } })).status).toBe(409);
    expect((await call(app, "GET", "/market/mine", { cookie: m.cookie })).text).toContain("Not allowed");
  });

  it("a deleted account's listings leave the public pages", async () => {
    const m = await seasoned("gone");
    const slug = (await post(app, m.cookie, VALID)).body.listing.slug;
    expect((await call(app, "GET", `/market/listings/${slug}`)).status).toBe(200);
    await prisma.user.update({ where: { id: m.id }, data: { deletedAt: new Date() } });
    expect((await call(app, "GET", `/market/listings/${slug}`)).status).toBe(404);
  });
});

describe("contact cooldown", () => {
  it("returns a token first, refuses early, releases the number after 10 seconds, and never shows it in the detail", async () => {
    const m = await seasoned("contact");
    const r = (await post(app, m.cookie, { ...VALID, phone: "01792 555 666" })).body.listing;
    expect((await call(app, "GET", `/market/listings/${r.slug}`)).text).not.toContain("555");
    expect((await call(app, "GET", "/market/listings")).text).not.toContain("555");

    const first = await call(app, "GET", `/market/listings/${r.slug}/contact`);
    expect(first.body.ready).toBe(false);
    expect(first.text).not.toContain("555");
    const early = await call(app, "GET", `/market/listings/${r.slug}/contact?token=${first.body.token}`);
    expect(early.status).toBe(425);
    expect(early.text).not.toContain("555");
    expect((await call(app, "GET", `/market/listings/${r.slug}/contact?token=junk`)).status).toBe(400);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 11_000);
    const late = await call(app, "GET", `/market/listings/${r.slug}/contact?token=${first.body.token}`);
    vi.useRealTimers();
    expect(late.status).toBe(200);
    expect(late.body.phone).toBe("01792 555 666");

    // A token for one listing does not open another.
    const other = (await post(app, m.cookie, VALID)).body.listing;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 11_000);
    const cross = await call(app, "GET", `/market/listings/${other.slug}/contact?token=${first.body.token}`);
    vi.useRealTimers();
    expect(cross.status).toBe(400);
  });

  it("has no view counter anywhere", async () => {
    const m = await seasoned("noviews");
    const r = (await post(app, m.cookie, VALID)).body.listing;
    expect((await call(app, "GET", `/market/listings/${r.slug}`)).text).not.toMatch(/views/i);
    const cols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `select column_name from information_schema.columns where table_name='MarketListing' and column_name ilike '%view%'`
    );
    expect(cols).toEqual([]);
  });
});
