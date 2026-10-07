import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { startTestDb, type TestDb } from "./helpers/testdb.js";
import { MemoryStorage } from "../src/common/storage.js";
import { hashPassword } from "../src/common/passwords.js";
import { call as memberCall, makeMember } from "./helpers/market.js";

vi.setConfig({ testTimeout: 90_000, hookTimeout: 240_000 });
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-hs256-signing";

let t: TestDb;
let prisma: PrismaClient;
let app: FastifyInstance;
let n = 0;
const PASSWORD = "Correct-horse-9";
const admins: Record<string, string> = {};

beforeAll(async () => {
  t = await startTestDb();
  process.env.DATABASE_URL = t.url;
  const { PrismaClient: Client } = await import("@prisma/client");
  prisma = new Client({ datasources: { db: { url: t.url } } });
  delete process.env.SEED_ADMIN_EMAIL;
  await (await import("../prisma/seed.js")).runSeed(prisma);
  const hash = await hashPassword(PASSWORD);
  for (const role of ["ADMIN", "MODERATOR", "VOLUNTEER"] as const) {
    await prisma.adminUser.create({ data: { name: role, email: `${role.toLowerCase()}@test.example`, role, passwordHash: hash } });
  }
  const { buildApp } = await import("../src/server.js");
  app = buildApp({ storage: new MemoryStorage() });
  await app.ready();
  for (const role of ["ADMIN", "MODERATOR", "VOLUNTEER"]) {
    const r = await app.inject({ method: "POST", url: "/admin/login", payload: { email: `${role.toLowerCase()}@test.example`, password: PASSWORD } });
    admins[role] = JSON.parse(r.body).accessToken;
  }
});
afterAll(async () => {
  await app?.close();
  await prisma?.$disconnect();
  await t?.stop();
});

type Method = "GET" | "POST" | "PATCH" | "DELETE";
async function call(method: Method, url: string, o: { admin?: string; body?: object } = {}) {
  const res = await app.inject({ method, url, headers: o.admin ? { authorization: `Bearer ${admins[o.admin]}` } : {}, ...(o.body ? { payload: o.body } : {}) });
  return { status: res.statusCode, text: res.body, body: res.body ? JSON.parse(res.body) : null };
}
async function listing(ownerId: string, over: Record<string, unknown> = {}) {
  const cat = await prisma.marketCategory.findFirstOrThrow({ where: { slug: "buy-and-sell" } });
  return prisma.marketListing.create({
    data: {
      slug: `a-${++n}-${Date.now()}`, ownerUserId: ownerId, kind: "SELL", title: "A thing", description: "x".repeat(30), categoryId: cat.id, pricePence: 1000,
      postcode: "SA5 9QQ", postcodeDistrict: "SA5", hideFullAddress: true, whatsapp: "07700900123", status: "PENDING", expiresAt: new Date(Date.now() + 86400_000), ...over,
    },
  });
}
const auditCount = (action: string) => prisma.auditLog.count({ where: { action } });

describe("roles", () => {
  it("rejects signed out (401) and volunteers (403) on every route", async () => {
    const m = await makeMember(prisma, `rl${++n}`);
    const l = await listing(m.id);
    const routes: [Method, string][] = [
      ["GET", "/admin/market/queue"], ["GET", "/admin/market/counts"], ["POST", `/admin/market/listings/${l.id}/approve`], ["POST", `/admin/market/listings/${l.id}/remove`],
      ["POST", `/admin/market/listings/${l.id}/restore`], ["POST", `/admin/market/users/${m.id}/remove-listings`], ["GET", "/admin/market/tickets"], ["PATCH", "/admin/market/tickets/x"],
      ["GET", "/admin/market/spots"], ["POST", "/admin/market/spots"], ["PATCH", "/admin/market/spots/x"], ["DELETE", "/admin/market/spots/x"], ["GET", "/admin/market/categories"], ["PATCH", "/admin/market/categories/x"],
    ];
    for (const [method, url] of routes) {
      expect((await call(method, url)).status, `${method} ${url}`).toBe(401);
      expect((await call(method, url, { admin: "VOLUNTEER" })).status, `${method} ${url}`).toBe(403);
    }
    expect((await memberCall(app, "GET", "/admin/market/queue", { cookie: m.cookie })).status).toBe(401);
  });
});

describe("listing queue", () => {
  it("lists pending and reported listings with admin only detail, approve and remove and restore are audited", async () => {
    const m = await makeMember(prisma, `q${++n}`);
    const pending = await listing(m.id);
    const reported = await listing(m.id, { status: "ACTIVE", reportCount: 1 });
    await prisma.marketReport.create({ data: { listingId: reported.id, reporterUserId: (await makeMember(prisma, `qr${++n}`)).id, reason: "Other", note: "odd" } });
    const q = await call("GET", "/admin/market/queue", { admin: "MODERATOR" });
    const ids = q.body.items.map((i: { id: string }) => i.id);
    expect(ids).toContain(pending.id);
    expect(ids).toContain(reported.id);
    expect(q.body.items.find((i: { id: string }) => i.id === pending.id).postcode).toBe("SA5 9QQ");
    expect((await call("GET", "/admin/market/queue?filter=reported", { admin: "MODERATOR" })).body.items.map((i: { id: string }) => i.id)).toEqual([reported.id]);
    expect((await call("GET", "/admin/market/counts", { admin: "MODERATOR" })).body.pending).toBeGreaterThan(0);

    const before = await auditCount("MARKET_APPROVE");
    expect((await call("POST", `/admin/market/listings/${pending.id}/approve`, { admin: "MODERATOR" })).status).toBe(200);
    expect((await prisma.marketListing.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe("ACTIVE");
    expect(await auditCount("MARKET_APPROVE")).toBe(before + 1);
    expect((await call("POST", `/admin/market/listings/${pending.id}/approve`, { admin: "MODERATOR" })).status).toBe(404); // no longer pending
    expect((await memberCall(app, "GET", `/market/listings/${pending.slug}`)).status).toBe(200);

    expect((await call("POST", `/admin/market/listings/${pending.id}/remove`, { admin: "MODERATOR", body: {} })).status).toBe(400);
    expect((await call("POST", `/admin/market/listings/${pending.id}/remove`, { admin: "MODERATOR", body: { reason: "Not allowed here" } })).status).toBe(200);
    expect(await auditCount("MARKET_REMOVE")).toBe(1);
    const mine = await memberCall(app, "GET", "/market/mine", { cookie: m.cookie });
    const row = mine.body.items.find((i: { id: string }) => i.id === pending.id);
    expect(row.status).toBe("REMOVED");
    expect(row.removalReason).toBe("Not allowed here");
    expect((await memberCall(app, "GET", `/market/listings/${pending.slug}`)).status).toBe(404);

    expect((await call("POST", `/admin/market/listings/${pending.id}/restore`, { admin: "ADMIN" })).status).toBe(200);
    expect((await prisma.marketListing.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe("ACTIVE");
    expect(await auditCount("MARKET_RESTORE")).toBe(1);
  });

  it("approving a reported listing clears its reports so it can be hidden again later", async () => {
    const m = await makeMember(prisma, `qa${++n}`);
    const l = await listing(m.id, { status: "PENDING", reportCount: 3 });
    for (let i = 0; i < 3; i++) await prisma.marketReport.create({ data: { listingId: l.id, reporterUserId: (await makeMember(prisma, `qa${++n}`)).id, reason: "Other" } });
    await call("POST", `/admin/market/listings/${l.id}/approve`, { admin: "MODERATOR" });
    const row = await prisma.marketListing.findUniqueOrThrow({ where: { id: l.id } });
    expect(row.reportCount).toBe(0);
    expect(await prisma.marketReport.count({ where: { listingId: l.id } })).toBe(0);
  });

  it("removes all of one member's listings in one action", async () => {
    const m = await makeMember(prisma, `ru${++n}`);
    await listing(m.id, { status: "ACTIVE" });
    await listing(m.id, { status: "PENDING" });
    await listing(m.id, { status: "REMOVED" });
    expect((await call("POST", `/admin/market/users/${m.id}/remove-listings`, { admin: "MODERATOR", body: { reason: "Scam seller" } })).body.removed).toBe(2);
    expect(await prisma.marketListing.count({ where: { ownerUserId: m.id, status: { not: "REMOVED" } } })).toBe(0);
    expect(await auditCount("MARKET_REMOVE_USER_LISTINGS")).toBe(1);
    expect((await call("POST", "/admin/market/users/nope/remove-listings", { admin: "MODERATOR", body: { reason: "Scam seller" } })).status).toBe(404);
  });
});

describe("tickets", () => {
  it("an admin replies and changes status, the member sees it on screen, audited", async () => {
    const m = await makeMember(prisma, `tk${++n}`);
    const created = await memberCall(app, "POST", "/market/tickets", { cookie: m.cookie, body: { category: "Other", message: "Please help me with this." } });
    const id = created.body.ticket.id;
    const list = await call("GET", "/admin/market/tickets?status=OPEN", { admin: "MODERATOR" });
    expect(list.body.items.map((i: { id: string }) => i.id)).toContain(id);
    expect((await call("PATCH", `/admin/market/tickets/${id}`, { admin: "MODERATOR", body: {} })).status).toBe(400);
    expect((await call("PATCH", `/admin/market/tickets/nope`, { admin: "MODERATOR", body: { status: "CLOSED" } })).status).toBe(404);
    const r = await call("PATCH", `/admin/market/tickets/${id}`, { admin: "MODERATOR", body: { adminReply: "We looked into it." } });
    expect(r.body.ticket.status).toBe("IN_PROGRESS");
    await call("PATCH", `/admin/market/tickets/${id}`, { admin: "MODERATOR", body: { status: "RESOLVED" } });
    const seen = await memberCall(app, "GET", "/market/tickets", { cookie: m.cookie });
    expect(seen.body.items[0]).toMatchObject({ status: "RESOLVED", adminReply: "We looked into it." });
    expect(await auditCount("TICKET_UPDATE")).toBe(2);
  });
});

describe("spots and categories", () => {
  it("spot CRUD is audited and feeds the public list", async () => {
    const bad = await call("POST", "/admin/market/spots", { admin: "MODERATOR", body: { name: "Library", address: "Alexandra Rd", postcodeDistrict: "nope" } });
    expect(bad.status).toBe(400);
    const c = await call("POST", "/admin/market/spots", { admin: "MODERATOR", body: { name: "Central Library front", address: "Alexandra Road", postcodeDistrict: "sa1" } });
    expect(c.status).toBe(201);
    const id = c.body.spot.id;
    expect(c.body.spot.postcodeDistrict).toBe("SA1");
    expect((await memberCall(app, "GET", "/market/spots")).body.spots.map((s: { id: string }) => s.id)).toContain(id);
    await call("PATCH", `/admin/market/spots/${id}`, { admin: "MODERATOR", body: { active: false } });
    expect((await memberCall(app, "GET", "/market/spots")).body.spots.map((s: { id: string }) => s.id)).not.toContain(id);
    expect((await call("DELETE", `/admin/market/spots/${id}`, { admin: "MODERATOR" })).status).toBe(200);
    expect((await call("DELETE", `/admin/market/spots/${id}`, { admin: "MODERATOR" })).status).toBe(404);
    expect(await prisma.auditLog.count({ where: { action: { startsWith: "SPOT_" } } })).toBe(3);
  });

  it("toggling staged shows or hides a category publicly", async () => {
    const cats = (await call("GET", "/admin/market/categories", { admin: "MODERATOR" })).body.categories;
    const housing = cats.find((c: { slug: string }) => c.slug.startsWith("housing"));
    expect(housing.staged).toBe(true);
    await call("PATCH", `/admin/market/categories/${housing.id}`, { admin: "MODERATOR", body: { staged: false } });
    expect((await memberCall(app, "GET", "/market/categories")).body.categories).toHaveLength(10);
    await call("PATCH", `/admin/market/categories/${housing.id}`, { admin: "MODERATOR", body: { staged: true } });
    expect((await memberCall(app, "GET", "/market/categories")).body.categories).toHaveLength(9);
    expect(await auditCount("MARKET_CATEGORY_STAGED")).toBe(2);
  });
});
