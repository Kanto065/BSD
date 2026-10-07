import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { vi } from "vitest";
import { startTestDb, type TestDb } from "./helpers/testdb.js";
import { MemoryStorage } from "../src/common/storage.js";
import { hashPassword } from "../src/common/passwords.js";
import { signToken, SESSION_COOKIE } from "../src/common/tokens.js";
import { verifyPassToken, makePassToken } from "../src/common/pass-token.js";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 240_000 });
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-hs256-signing";

let t: TestDb;
let prisma: PrismaClient;
let app: FastifyInstance;
const admins: Record<string, string> = {};
const PASSWORD = "Correct-Horse-Battery-77";
let n = 0;

const DEV_A = "device-aaaaaaaaaaaaaaaa";
const DEV_B = "device-bbbbbbbbbbbbbbbb";
const DEV_C = "device-cccccccccccccccc";
const DEV_D = "device-dddddddddddddddd";
const DEV_E = "device-eeeeeeeeeeeeeeee";

async function member(opts: { module?: boolean } = {}) {
  n++;
  const u = await prisma.user.create({
    data: { name: `Gwen Jones ${n}`, email: `pass${n}@test.example`, passwordHash: "x", postcode: "SA1 4PE", postcodeDistrict: "SA1", ...(opts.module === false ? {} : { modules: { create: { module: "CARD" } } }) },
  });
  return { id: u.id, cookie: `${SESSION_COOKIE}=${signToken("session", u.id, u.tokenVersion)}` };
}

async function call(method: "GET" | "POST", url: string, o: { cookie?: string; device?: string; admin?: string; body?: object; headers?: Record<string, string> } = {}) {
  const res = await app.inject({
    method,
    url,
    headers: { ...(o.cookie ? { cookie: o.cookie } : {}), ...(o.device ? { "x-device": o.device } : {}), ...(o.admin ? { authorization: `Bearer ${admins[o.admin]}` } : {}), ...o.headers },
    ...(o.body ? { payload: o.body } : {}),
  });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null, raw: res.body, headers: res.headers };
}

const claim = (cookie: string) => call("POST", "/pass/claim", { cookie, body: { agreeShare: true } });
const token = (cookie: string, device: string) => call("GET", "/pass/token", { cookie, device });
const move = (cookie: string, device: string) => call("POST", "/pass/move", { cookie, device });

async function claimed() {
  const m = await member();
  await claim(m.cookie);
  return m;
}

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

describe("access", () => {
  it("401 signed out, 403 without the CARD module, 400 without a device header", async () => {
    expect((await call("GET", "/pass/me")).status).toBe(401);
    const noModule = await member({ module: false });
    expect((await call("GET", "/pass/me", { cookie: noModule.cookie })).status).toBe(403);
    expect((await claim(noModule.cookie)).body.error).toBe("Join Privilege Pass to use this.");
    const m = await claimed();
    expect((await call("GET", "/pass/token", { cookie: m.cookie })).status).toBe(400);
    expect((await call("GET", "/pass/token", { cookie: m.cookie, device: "short" })).status).toBe(400);
    expect((await call("GET", "/pass/token", { cookie: m.cookie, device: "bad chars here!!!!!!!!" })).status).toBe(400);
  });
});

describe("claim", () => {
  it("needs consent, is idempotent, and shows no secret", async () => {
    const m = await member();
    expect((await call("POST", "/pass/claim", { cookie: m.cookie, body: {} })).status).toBe(400);
    expect((await call("POST", "/pass/claim", { cookie: m.cookie, body: { agreeShare: false } })).status).toBe(400);
    expect((await call("GET", "/pass/me", { cookie: m.cookie })).status).toBe(404);
    const a = await claim(m.cookie);
    const b = await claim(m.cookie);
    expect(a.status).toBe(200);
    expect(a.body.cardNumber).toMatch(/^BC-\d{4}-\d{6}$/);
    expect(b.body.cardNumber).toBe(a.body.cardNumber);
    expect(a.body).toMatchObject({ levelLabel: "Level 1: Resident", district: "SA1", status: "ACTIVE", initials: "GJ" });
    expect(a.raw).not.toMatch(/Verified/);
    expect(await prisma.privilegeCard.count({ where: { userId: m.id } })).toBe(1);
    const me = await call("GET", "/pass/me", { cookie: m.cookie });
    const secret = (await prisma.privilegeCard.findUnique({ where: { userId: m.id } }))!.secret;
    for (const r of [a, b, me]) {
      expect(r.raw).not.toContain(secret);
      expect(r.raw).not.toMatch(/secret|deviceHash/);
      expect(r.raw).not.toContain("@");
    }
  });

  // A truly concurrent claim cannot be driven here: PGlite has one shared session and fails overlapping Prisma queries
  // with a protocol error. The one-card guarantee is the unique index on userId (see the migration test).
  it("a second claim after a unique clash returns the existing card", async () => {
    const m = await member();
    const first = await claim(m.cookie);
    expect((await claim(m.cookie)).body.cardNumber).toBe(first.body.cardNumber);
  });
});

describe("token", () => {
  it("verifies, holds no personal data, and never reaches the member in a body with the secret", async () => {
    const m = await claimed();
    const r = await token(m.cookie, DEV_A);
    expect(r.status).toBe(200);
    expect(r.body.expiresInSeconds).toBeGreaterThan(0);
    expect(r.body.expiresInSeconds).toBeLessThanOrEqual(30);
    expect(Math.abs(r.body.serverTime - Date.now())).toBeLessThan(5000);
    const card = (await prisma.privilegeCard.findUnique({ where: { userId: m.id } }))!;
    expect(verifyPassToken(r.body.token, card)).toBe(true);
    expect(verifyPassToken(r.body.token, card, Date.now() + 61_000)).toBe(false);
    expect(Buffer.from(r.body.token.split(".")[0], "base64url").toString()).toBe(card.id);
    expect(r.raw).not.toContain(card.secret);
    expect(card.deviceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(card.deviceHash).not.toContain(DEV_A);
    expect(r.headers["cache-control"]).toBe("no-store");
  });

  it("404 before claiming and 403 when suspended", async () => {
    const m = await member();
    expect((await token(m.cookie, DEV_A)).status).toBe(404);
    await claim(m.cookie);
    await prisma.privilegeCard.update({ where: { userId: m.id }, data: { status: "SUSPENDED" } });
    expect((await token(m.cookie, DEV_A)).status).toBe(403);
    expect((await move(m.cookie, DEV_A)).status).toBe(403);
  });

  it("is rate limited to 30 a minute", async () => {
    const m = await claimed();
    const h = { "x-forwarded-for": "203.0.113.9" };
    let last = 0;
    for (let i = 0; i < 31; i++) last = (await call("GET", "/pass/token", { cookie: m.cookie, device: DEV_A, headers: h })).status;
    expect(last).toBe(429);
  });
});

describe("single device lock", () => {
  it("first phone binds, second gets 409 with canMove, same phone keeps working", async () => {
    const m = await claimed();
    expect((await token(m.cookie, DEV_A)).status).toBe(200);
    const other = await token(m.cookie, DEV_B);
    expect(other.status).toBe(409);
    expect(other.body).toEqual({ error: "Your pass is open on another device.", canMove: true });
    expect(other.raw).not.toContain("token\"");
    expect((await token(m.cookie, DEV_A)).status).toBe(200);
  });

  it("racing first opens on two phones bind exactly one", async () => {
    const m = await claimed();
    const rs = await Promise.all([token(m.cookie, DEV_A), token(m.cookie, DEV_B)]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
    const card = (await prisma.privilegeCard.findUnique({ where: { userId: m.id } }))!;
    const winner = rs[0]!.status === 200 ? DEV_A : DEV_B;
    expect((await token(m.cookie, winner)).status).toBe(200);
    expect(card.deviceMoves).toBe(0);
  });

  it("move hands the pass over and the old phone's token and access stop", async () => {
    const m = await claimed();
    const old = (await token(m.cookie, DEV_A)).body.token as string;
    expect((await move(m.cookie, DEV_B)).status).toBe(200);
    const card = (await prisma.privilegeCard.findUnique({ where: { userId: m.id } }))!;
    expect(verifyPassToken(old, card)).toBe(false);
    expect((await token(m.cookie, DEV_A)).status).toBe(409);
    const fresh = await token(m.cookie, DEV_B);
    expect(fresh.status).toBe(200);
    expect(verifyPassToken(fresh.body.token, card)).toBe(true);
    // a token cannot be made for a stale device state either
    expect(verifyPassToken(makePassToken({ ...card, deviceHash: "x" })!, card)).toBe(false);
  });

  it("moving to the phone that already owns the pass is free", async () => {
    const m = await claimed();
    await token(m.cookie, DEV_A);
    expect((await move(m.cookie, DEV_A)).status).toBe(200);
    expect((await prisma.privilegeCard.findUnique({ where: { userId: m.id } }))!.deviceMoves).toBe(0);
  });

  it("allows 3 moves in 7 days, the 4th is 429, an admin reset clears it, and the window rolls over", async () => {
    const m = await claimed();
    await token(m.cookie, DEV_A);
    expect((await move(m.cookie, DEV_B)).status).toBe(200);
    expect((await move(m.cookie, DEV_C)).status).toBe(200);
    expect((await move(m.cookie, DEV_D)).status).toBe(200);
    const fourth = await move(m.cookie, DEV_E);
    expect(fourth.status).toBe(429);
    expect(fourth.body.error).toBe("Ask the BSD team to reset your pass.");
    expect((await token(m.cookie, DEV_D)).status).toBe(200);
    expect((await token(m.cookie, DEV_E)).status).toBe(409);

    const card = (await prisma.privilegeCard.findUnique({ where: { userId: m.id } }))!;
    expect(card.deviceMoves).toBe(3);
    // an old window no longer counts
    await prisma.privilegeCard.update({ where: { id: card.id }, data: { deviceMovesResetAt: new Date(Date.now() - 1000) } });
    expect((await move(m.cookie, DEV_E)).status).toBe(200);
    expect((await prisma.privilegeCard.findUnique({ where: { id: card.id } }))!.deviceMoves).toBe(1);

    const reset = await call("POST", `/admin/passes/${card.id}/reset-device`, { admin: "MODERATOR" });
    expect(reset.status).toBe(200);
    const after = (await prisma.privilegeCard.findUnique({ where: { id: card.id } }))!;
    expect(after).toMatchObject({ deviceHash: null, deviceMoves: 0, deviceMovesResetAt: null });
    expect((await token(m.cookie, DEV_A)).status).toBe(200);
  });

  it("racing moves never exceed the limit or double count a double tap", async () => {
    const m = await claimed();
    await token(m.cookie, DEV_A);
    // a double tap from one phone counts once
    const dbl = await Promise.all([move(m.cookie, DEV_B), move(m.cookie, DEV_B)]);
    expect(dbl.map((r) => r.status)).toEqual([200, 200]);
    expect((await prisma.privilegeCard.findUnique({ where: { userId: m.id } }))!.deviceMoves).toBe(1);
    // five phones race for the remaining two moves
    const rs = await Promise.all([DEV_A, DEV_C, DEV_D, DEV_E, "device-ffffffffffffffff"].map((d) => move(m.cookie, d)));
    const ok = rs.filter((r) => r.status === 200).length;
    const limited = rs.filter((r) => r.status === 429).length;
    expect(ok).toBe(2);
    expect(limited).toBe(3);
    expect((await prisma.privilegeCard.findUnique({ where: { userId: m.id } }))!.deviceMoves).toBe(3);
  });

  it("each member's lock is independent and the same device id on two cards hashes differently", async () => {
    const a = await claimed();
    const b = await claimed();
    expect((await token(a.cookie, DEV_A)).status).toBe(200);
    expect((await token(b.cookie, DEV_A)).status).toBe(200);
    const [ca, cb] = await Promise.all([a, b].map((x) => prisma.privilegeCard.findUnique({ where: { userId: x.id } })));
    expect(ca!.deviceHash).not.toBe(cb!.deviceHash);
  });
});

describe("savings", () => {
  it("sums confirmed savings only, counts shops, and splits this year", async () => {
    const m = await claimed();
    expect((await call("GET", "/pass/savings", { cookie: m.cookie })).body).toEqual({ totalPence: 0, count: 0, shops: 0, thisYearPence: 0 });
    const card = (await prisma.privilegeCard.findUnique({ where: { userId: m.id } }))!;
    const zone = await prisma.coverageZone.findFirstOrThrow();
    const cat = await prisma.category.findFirstOrThrow();
    const biz = async (slug: string) =>
      prisma.business.create({ data: { slug, name: slug, categoryId: cat.id, description: "d", phone: "1", postcode: "SA1 1AA", postcodeDistrict: "SA1", zoneId: zone.id } });
    const [b1, b2] = [await biz("sav-1"), await biz("sav-2")];
    const o1 = await prisma.privilegeOffer.create({ data: { businessId: b1.id, title: "10 off", terms: "Show the pass", status: "ACTIVE" } });
    const o2 = await prisma.privilegeOffer.create({ data: { businessId: b2.id, title: "5 off", terms: "Show the pass", status: "ACTIVE" } });
    const row = (offerId: string, businessId: string, extra: object) => prisma.privilegeRedemption.create({ data: { cardId: card.id, offerId, businessId, scannedByUserId: m.id, method: "QR", ...extra } });
    const now = new Date();
    await row(o1.id, b1.id, { confirmedAt: now, billPence: 2000, savingPence: 200 });
    await row(o1.id, b1.id, { confirmedAt: now, billPence: 1000, savingPence: 100 });
    await row(o2.id, b2.id, { confirmedAt: new Date(Date.UTC(2020, 5, 1)), billPence: 5000, savingPence: 500 });
    await row(o2.id, b2.id, {}); // scanned, never confirmed
    expect((await call("GET", "/pass/savings", { cookie: m.cookie })).body).toEqual({ totalPence: 800, count: 3, shops: 2, thisYearPence: 300 });
  });
});

describe("admin", () => {
  it("lists without secrets, suspends and restores with audit rows, and enforces the role", async () => {
    const m = await claimed();
    const card = (await prisma.privilegeCard.findUnique({ where: { userId: m.id } }))!;
    expect((await call("GET", "/admin/passes")).status).toBe(401);
    expect((await call("GET", "/admin/passes", { admin: "VOLUNTEER" })).status).toBe(403);
    const list = await call("GET", `/admin/passes?q=${card.cardNumber}`, { admin: "MODERATOR" });
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.raw).not.toContain(card.secret);
    expect(list.raw).not.toContain("deviceHash");
    expect(list.body.items[0].user.name).toMatch(/Gwen/);

    expect((await call("POST", `/admin/passes/${card.id}/suspend`, { admin: "VOLUNTEER" })).status).toBe(403);
    expect((await call("POST", `/admin/passes/${card.id}/suspend`, { admin: "MODERATOR" })).status).toBe(200);
    expect((await prisma.privilegeCard.findUnique({ where: { id: card.id } }))!.status).toBe("SUSPENDED");
    expect((await token(m.cookie, DEV_A)).status).toBe(403);
    expect((await call("POST", `/admin/passes/${card.id}/restore`, { admin: "ADMIN" })).status).toBe(200);
    expect((await token(m.cookie, DEV_A)).status).toBe(200);
    expect((await call("POST", "/admin/passes/nope/suspend", { admin: "MODERATOR" })).status).toBe(404);

    const actions = (await prisma.auditLog.findMany({ where: { entityId: card.id } })).map((a) => a.action).sort();
    expect(actions).toEqual(["PASS_RESTORE", "PASS_SUSPEND"]);
  });
});

describe("production without the server secret", () => {
  it("fails closed with 503 and sends no token", async () => {
    const m = await claimed();
    const prev = { env: process.env.NODE_ENV, s: process.env.PASS_TOKEN_SECRET };
    process.env.NODE_ENV = "production";
    delete process.env.PASS_TOKEN_SECRET;
    try {
      const r = await token(m.cookie, DEV_A);
      expect(r.status).toBe(503);
      expect(r.raw).not.toContain("token\"");
    } finally {
      process.env.NODE_ENV = prev.env;
      if (prev.s !== undefined) process.env.PASS_TOKEN_SECRET = prev.s;
    }
  });
});
