import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { startTestDb, type TestDb } from "./helpers/testdb.js";
import { MemoryStorage } from "../src/common/storage.js";
import { call, makeMember } from "./helpers/market.js";

vi.setConfig({ testTimeout: 90_000, hookTimeout: 240_000 });
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-hs256-signing";

let t: TestDb;
let prisma: PrismaClient;
let app: FastifyInstance;
let n = 0;

beforeAll(async () => {
  t = await startTestDb();
  process.env.DATABASE_URL = t.url;
  const { PrismaClient: Client } = await import("@prisma/client");
  prisma = new Client({ datasources: { db: { url: t.url } } });
  delete process.env.SEED_ADMIN_EMAIL;
  await (await import("../prisma/seed.js")).runSeed(prisma);
  const { buildApp } = await import("../src/server.js");
  app = buildApp({ storage: new MemoryStorage() });
  await app.ready();
});
afterAll(async () => {
  await app?.close();
  await prisma?.$disconnect();
  await t?.stop();
});

async function listing(ownerId: string, over: Record<string, unknown> = {}) {
  const cat = await prisma.marketCategory.findFirstOrThrow({ where: { slug: "buy-and-sell" } });
  return prisma.marketListing.create({
    data: {
      slug: `l-${++n}-${Date.now()}`, ownerUserId: ownerId, kind: "SELL", title: "A thing", description: "x".repeat(30), categoryId: cat.id, pricePence: 1000,
      postcode: "SA1 4PE", postcodeDistrict: "SA1", whatsapp: "07700900123", status: "ACTIVE", expiresAt: new Date(Date.now() + 86400_000), ...over,
    },
  });
}

describe("reports", () => {
  it("needs the module, dedupes, blocks the owner, and three distinct reports send the listing to review", async () => {
    const owner = await makeMember(prisma, `rown${++n}`);
    const l = await listing(owner.id);
    const url = `/market/listings/${l.id}/report`;
    const body = { reason: "Scam or fraud" };
    expect((await call(app, "POST", url, { body })).status).toBe(401);
    expect((await call(app, "POST", url, { cookie: (await makeMember(prisma, `nm${++n}`, null)).cookie, body })).status).toBe(403);
    expect((await call(app, "POST", url, { cookie: owner.cookie, body })).status).toBe(400);
    const a = await makeMember(prisma, `ra${++n}`);
    expect((await call(app, "POST", url, { cookie: a.cookie, body: { reason: "Nonsense" } })).status).toBe(400);
    expect((await call(app, "POST", url, { cookie: a.cookie, body })).status).toBe(201);
    const again = await call(app, "POST", url, { cookie: a.cookie, body });
    expect(again.body.already).toBe(true);
    expect((await prisma.marketListing.findUniqueOrThrow({ where: { id: l.id } })).reportCount).toBe(1);
    const b = await makeMember(prisma, `rb${++n}`);
    expect((await call(app, "POST", url, { cookie: b.cookie, body })).body.underReview).toBe(false);
    expect((await prisma.marketListing.findUniqueOrThrow({ where: { id: l.id } })).status).toBe("ACTIVE");
    const c = await makeMember(prisma, `rc${++n}`);
    expect((await call(app, "POST", url, { cookie: c.cookie, body })).body.underReview).toBe(true);
    const row = await prisma.marketListing.findUniqueOrThrow({ where: { id: l.id } });
    expect(row.status).toBe("PENDING");
    expect(row.reportCount).toBe(3);
    expect((await call(app, "GET", `/market/listings/${l.slug}`)).status).toBe(404);
    const mine = await call(app, "GET", "/market/mine", { cookie: owner.cookie });
    expect(mine.body.items[0].status).toBe("PENDING");
    expect(mine.body.items[0].reportCount).toBe(3);
    // A hidden listing can no longer be reported (404).
    expect((await call(app, "POST", url, { cookie: (await makeMember(prisma, `rd${++n}`)).cookie, body })).status).toBe(404);
  });

  it("a listing that is not public is a 404 for reports", async () => {
    const owner = await makeMember(prisma, `rpo${++n}`);
    const l = await listing(owner.id, { status: "PENDING" });
    const m = await makeMember(prisma, `rpm${++n}`);
    expect((await call(app, "POST", `/market/listings/${l.id}/report`, { cookie: m.cookie, body: { reason: "Other" } })).status).toBe(404);
    expect((await call(app, "POST", `/market/listings/nope/report`, { cookie: m.cookie, body: { reason: "Other" } })).status).toBe(404);
  });
});

describe("saves", () => {
  it("is idempotent, private to the member, hides non public listings, and never leaks a hidden address", async () => {
    const owner = await makeMember(prisma, `so${++n}`);
    const l = await listing(owner.id, { hideFullAddress: true, postcode: "SA5 9QQ", postcodeDistrict: "SA5" });
    const pending = await listing(owner.id, { status: "PENDING" });
    const m = await makeMember(prisma, `sm${++n}`);
    expect((await call(app, "GET", "/market/saves")).status).toBe(401);
    expect((await call(app, "PUT", `/market/saves/${l.id}`, { cookie: m.cookie })).status).toBe(200);
    expect((await call(app, "PUT", `/market/saves/${l.id}`, { cookie: m.cookie })).status).toBe(200);
    expect((await call(app, "PUT", `/market/saves/${pending.id}`, { cookie: m.cookie })).status).toBe(404);
    expect(await prisma.marketSave.count({ where: { userId: m.id } })).toBe(1);
    const list = await call(app, "GET", "/market/saves", { cookie: m.cookie });
    expect(list.body.items).toHaveLength(1);
    expect(list.text).not.toContain("9QQ");
    expect(list.body.items[0].postcodeDistrict).toBe("SA5");
    const other = await makeMember(prisma, `so2${++n}`);
    expect((await call(app, "GET", "/market/saves", { cookie: other.cookie })).body.items).toHaveLength(0);
    await prisma.marketListing.update({ where: { id: l.id }, data: { status: "REMOVED" } });
    expect((await call(app, "GET", "/market/saves", { cookie: m.cookie })).body.items).toHaveLength(0);
    expect((await call(app, "DELETE", `/market/saves/${l.id}`, { cookie: m.cookie })).status).toBe(200);
    expect((await call(app, "DELETE", `/market/saves/${l.id}`, { cookie: m.cookie })).status).toBe(200);
    expect(await prisma.marketSave.count({ where: { userId: m.id } })).toBe(0);
  });
});

describe("buyer requests", () => {
  it("are BUY listings, served by the filtered list", async () => {
    const o = await makeMember(prisma, `bo${++n}`);
    const buy = await listing(o.id, { kind: "BUY", title: "Wanted a desk", pricePence: null });
    await listing(o.id, { kind: "SELL" });
    const res = await call(app, "GET", "/market/listings?kind=BUY");
    expect(res.body.items.every((i: { kind: string }) => i.kind === "BUY")).toBe(true);
    expect(res.body.items.map((i: { slug: string }) => i.slug)).toContain(buy.slug);
  });
});

describe("tickets", () => {
  it("allocates ordered unique numbers, shows tickets only to the owner, and limits to 5 a day", async () => {
    const m = await makeMember(prisma, `tm${++n}`);
    const other = await makeMember(prisma, `to${++n}`);
    const ok = { category: "My account", message: "I cannot change my phone number." };
    expect((await call(app, "POST", "/market/tickets", { body: ok })).status).toBe(401);
    expect((await call(app, "POST", "/market/tickets", { cookie: (await makeMember(prisma, `tn${++n}`, null)).cookie, body: ok })).status).toBe(403);
    expect((await call(app, "POST", "/market/tickets", { cookie: m.cookie, body: { ...ok, message: "short" } })).status).toBe(400);
    expect((await call(app, "POST", "/market/tickets", { cookie: m.cookie, body: { ...ok, category: "Nope" } })).status).toBe(400);
    expect((await call(app, "POST", "/market/tickets", { cookie: m.cookie, body: { ...ok, listingId: "missing" } })).status).toBe(400);
    const nums: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await call(app, "POST", "/market/tickets", { cookie: m.cookie, body: ok });
      expect(r.status).toBe(201);
      nums.push(r.body.ticket.number);
    }
    expect(nums.every((x) => /^#BC-\d{4}$/.test(x))).toBe(true);
    expect(new Set(nums).size).toBe(5);
    expect(nums).toEqual([...nums].sort());
    expect((await call(app, "POST", "/market/tickets", { cookie: m.cookie, body: ok })).status).toBe(429);
    // Another member is not limited by this one and sees none of these tickets.
    expect((await call(app, "POST", "/market/tickets", { cookie: other.cookie, body: ok })).status).toBe(201);
    const mine = await call(app, "GET", "/market/tickets", { cookie: m.cookie });
    expect(mine.body.items).toHaveLength(5);
    expect((await call(app, "GET", "/market/tickets", { cookie: other.cookie })).body.items).toHaveLength(1);
  });

  it("lets a ticket point at the member's own removed listing but not at someone else's hidden one", async () => {
    const m = await makeMember(prisma, `tl${++n}`);
    const o = await makeMember(prisma, `tlo${++n}`);
    const own = await listing(m.id, { status: "REMOVED" });
    const theirs = await listing(o.id, { status: "PENDING" });
    const body = { category: "Listing problem", message: "Why was my listing removed?" };
    expect((await call(app, "POST", "/market/tickets", { cookie: m.cookie, body: { ...body, listingId: own.id } })).status).toBe(201);
    expect((await call(app, "POST", "/market/tickets", { cookie: m.cookie, body: { ...body, listingId: theirs.id } })).status).toBe(400);
  });
});
