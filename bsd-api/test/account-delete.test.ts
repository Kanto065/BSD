import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { startTestDb, type TestDb } from "./helpers/testdb.js";
import { MemoryStorage } from "../src/common/storage.js";
import { hashPassword } from "../src/common/passwords.js";
import { SESSION_COOKIE } from "../src/common/tokens.js";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 240_000 });
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-hs256-signing";

let t: TestDb;
let prisma: PrismaClient;
let app: FastifyInstance;
let storage: MemoryStorage;
let adminToken = "";

const PASSWORD = "Correct-Horse-Battery-77";
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);

async function call(method: string, url: string, opts: { body?: unknown; cookie?: string; token?: string } = {}) {
  const res = await app.inject({
    method: method as "GET",
    url,
    headers: { ...(opts.cookie ? { cookie: opts.cookie } : {}), ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
    ...(opts.body !== undefined ? { payload: opts.body as object } : {}),
  });
  const raw = res.headers["set-cookie"];
  const setCookie = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null, setCookie, cookie: setCookie ? setCookie.split(";")[0] : undefined };
}

async function signIn(email: string, password = PASSWORD) {
  return call("POST", "/auth/login", { body: { email, password } });
}

beforeAll(async () => {
  t = await startTestDb();
  process.env.DATABASE_URL = t.url;
  const { PrismaClient: Client } = await import("@prisma/client");
  prisma = new Client({ datasources: { db: { url: t.url } } });
  delete process.env.SEED_ADMIN_EMAIL;
  await (await import("../prisma/seed.js")).runSeed(prisma);
  await prisma.adminUser.create({ data: { name: "Admin", email: "admin@test.example", role: "ADMIN", passwordHash: await hashPassword(PASSWORD) } });
  storage = new MemoryStorage();
  const { buildApp } = await import("../src/server.js");
  app = buildApp({ storage });
  await app.ready();
  adminToken = (await call("POST", "/admin/login", { body: { email: "admin@test.example", password: PASSWORD } })).body.accessToken;
});

afterAll(async () => {
  await app?.close();
  await prisma?.$disconnect();
  await t?.stop();
});

async function makeMember(email: string) {
  await prisma.user.create({
    data: {
      name: "Rina Begum",
      email,
      passwordHash: await hashPassword(PASSWORD),
      postcode: "SA1 4PE",
      postcodeDistrict: "SA1",
      phone: "01792 123 456",
      accountType: "STUDENT",
      modules: { create: { module: "DIRECTORY" } },
      badges: { create: [{ badge: "MEMBER" }, { badge: "STUDENT" }] },
    },
  });
  const r = await signIn(email);
  return { id: r.body.user.id as string, cookie: r.cookie! };
}

async function listingFor(ownerUserId: string, slug: string) {
  const zone = await prisma.coverageZone.findUniqueOrThrow({ where: { slug: "zone-1" } });
  const category = await prisma.category.findFirstOrThrow({ where: { status: "APPROVED", requiresOwnerName: false } });
  return prisma.business.create({
    data: {
      slug,
      name: "Rina Bakery",
      categoryId: category.id,
      description: "x".repeat(160),
      servicesOffered: ["Bread"],
      phone: "01792 123 456",
      postcode: "SA1 4PE",
      postcodeDistrict: "SA1",
      zoneId: zone.id,
      otherAreaText: "Around Swansea",
      status: "APPROVED",
      ownerUserId,
    },
  });
}

describe("DELETE /auth/me", () => {
  it("needs a signed in member and the current password", async () => {
    expect((await call("DELETE", "/auth/me", { body: { password: PASSWORD } })).status).toBe(401);
    const m = await makeMember("wrongpw@test.example");
    const bad = await call("DELETE", "/auth/me", { cookie: m.cookie, body: { password: "not-the-password" } });
    expect(bad.status).toBe(400);
    expect(bad.body.fieldErrors.password).toMatch(/not correct/);
    expect((await call("DELETE", "/auth/me", { cookie: m.cookie, body: {} })).status).toBe(400);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: m.id } });
    expect(row.deletedAt).toBeNull();
    expect(row.email).toBe("wrongpw@test.example");
    expect((await call("GET", "/auth/me", { cookie: m.cookie })).status).toBe(200);
  });

  it("anonymizes the account, keeps badges and listings, ends sessions, and frees the email", async () => {
    const m = await makeMember("rina@test.example");
    await prisma.businessProfile.create({ data: { userId: m.id, data: { name: "Rina Bakery", phone: "01792 123 456" }, step: 2 } });
    const listing = await listingFor(m.id, "rina-bakery");

    const del = await call("DELETE", "/auth/me", { cookie: m.cookie, body: { password: PASSWORD } });
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ ok: true });
    expect(del.setCookie).toContain(`${SESSION_COOKIE}=;`); // the cookie is cleared

    const row = await prisma.user.findUniqueOrThrow({ where: { id: m.id } });
    expect(row.deletedAt).toBeInstanceOf(Date);
    expect(row.email).toBe(`deleted-${m.id}@deleted.invalid`);
    expect(row.name).toBe("Deleted account");
    expect(row.phone).toBeNull();
    expect(row.postcode).toBe("");
    expect(row.postcodeDistrict).toBe("");
    expect(row.tokenVersion).toBe(1);
    expect(await prisma.businessProfile.count({ where: { userId: m.id } })).toBe(0);
    expect((await prisma.userBadge.findMany({ where: { userId: m.id } })).map((b) => b.badge).sort()).toEqual(["MEMBER", "STUDENT"]);

    // The listing stays live and linked, and nothing about the member leaks through the public pages.
    const kept = await prisma.business.findUniqueOrThrow({ where: { id: listing.id } });
    expect(kept.ownerUserId).toBe(m.id);
    expect(kept.status).toBe("APPROVED");
    const pub = await call("GET", "/businesses/rina-bakery");
    expect(pub.status).toBe(200);
    const text = JSON.stringify(pub.body);
    expect(text).not.toContain("rina@test.example");
    expect(text).not.toContain("Rina Begum");
    expect(text).not.toContain("Deleted account");

    // The old session and the old password no longer work, on any route that needs a member.
    expect((await call("GET", "/auth/me", { cookie: m.cookie })).status).toBe(401);
    expect((await call("GET", "/auth/listings", { cookie: m.cookie })).status).toBe(401);
    const login = await signIn("rina@test.example");
    expect(login.status).toBe(401);
    expect((await signIn(`deleted-${m.id}@deleted.invalid`)).status).toBe(401);
  });

  it("lets the same email register again as a new account", async () => {
    const again = await call("POST", "/auth/register", {
      body: { name: "Rina New", email: "rina@test.example", password: PASSWORD, postcode: "SA1 4PE", accountType: "GENERAL" },
    });
    expect(again.status).toBe(201);
    expect(again.body.user.name).toBe("Rina New");
    const users = await prisma.user.findMany({ where: { OR: [{ email: "rina@test.example" }, { name: "Deleted account" }] } });
    expect(users).toHaveLength(2);
    expect(users.find((u) => u.email === "rina@test.example")!.deletedAt).toBeNull();
    // The new account starts clean: no listings and no student badge from the old one.
    expect(again.body.user.listingCount).toBe(0);
    expect(again.body.user.badges).toEqual(["MEMBER"]);
  });

  it("deletes a pending student proof file, marks the request withdrawn, and shows Deleted account to admins", async () => {
    const m = await makeMember("student@test.example");
    const key = `students/${m.id}/proof.png`;
    await storage.put({ key, body: PNG, contentType: "image/png", private: true });
    const row = await prisma.studentVerification.create({
      data: { userId: m.id, proofKey: key, proofType: "image/png", proofBytes: PNG.length, note: "my card", purgeAt: new Date(Date.now() + 7 * 86_400_000) },
    });
    const listing = await listingFor(m.id, "student-cafe");

    expect((await call("DELETE", "/auth/me", { cookie: m.cookie, body: { password: PASSWORD } })).status).toBe(200);

    expect(await storage.get(key, { private: true })).toBeNull();
    const after = await prisma.studentVerification.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.status).toBe("EXPIRED");
    expect(after.proofKey).toBeNull();
    expect(after.purgedAt).toBeInstanceOf(Date);
    expect(after.note).toBeNull();

    const students = await call("GET", "/admin/students?status=ALL", { token: adminToken });
    const item = students.body.items.find((i: { id: string }) => i.id === row.id);
    expect(item.user.name).toBe("Deleted account");
    expect(item.user.email).toBeNull();
    expect(JSON.stringify(students.body)).not.toContain("student@test.example");

    const detail = await call("GET", `/admin/listings/${listing.id}`, { token: adminToken });
    expect(detail.body.listing.owner).toEqual({ id: m.id, name: "Deleted account", email: null });
    // A deleted account cannot be linked again by its placeholder address.
    const link = await call("PUT", `/admin/listings/${listing.id}/owner`, { token: adminToken, body: { email: `deleted-${m.id}@deleted.invalid` } });
    expect(link.status).toBe(404);
  });

  it("is rate limited", async () => {
    const m = await makeMember("limited@test.example");
    let last = 0;
    for (let i = 0; i < 6; i++) last = (await call("DELETE", "/auth/me", { cookie: m.cookie, body: { password: "wrong-password-1" } })).status;
    expect(last).toBe(429);
  });
});
