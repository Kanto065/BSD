import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { startTestDb, type TestDb } from "./helpers/testdb.js";
import { MemoryStorage } from "../src/common/storage.js";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 240_000 });
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-hs256-signing";

let t: TestDb;
let prisma: PrismaClient;
let app: FastifyInstance;

const PASSWORD = "Correct-Horse-Battery-77";
const signup = { name: "Test Member", email: "member@test.example", password: PASSWORD, postcode: "sa1 4pe", accountType: "GENERAL" };

async function call(method: string, url: string, opts: { body?: unknown; cookie?: string } = {}) {
  const res = await app.inject({
    method: method as "GET",
    url,
    headers: opts.cookie ? { cookie: opts.cookie } : {},
    ...(opts.body !== undefined ? { payload: opts.body as object } : {}),
  });
  const raw = res.headers["set-cookie"];
  const setCookie = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null, setCookie, cookie: setCookie ? setCookie.split(";")[0] : undefined };
}

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

describe("shared member login", () => {
  it("registers, joins the site, gets the MEMBER badge and a shared httpOnly cookie", async () => {
    const r = await call("POST", "/auth/register", { body: { ...signup, module: "CARD" } });
    expect(r.status).toBe(201);
    expect(r.body.user).toMatchObject({ email: signup.email, postcode: "SA1 4PE", modules: ["CARD"], badges: ["MEMBER"] });
    expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|\$2b\$/);
    expect(r.setCookie).toMatch(/^bsd_session=/);
    expect(r.setCookie).toMatch(/HttpOnly/i);
    expect(r.setCookie).toMatch(/Path=\//);
  });

  it("recognises the cookie on /auth/me and rejects a request without one", async () => {
    const login = await call("POST", "/auth/login", { body: { email: signup.email, password: PASSWORD, module: "MARKETPLACE" } });
    expect(login.status).toBe(200);
    // signing in on another site joins it
    expect([...login.body.user.modules].sort()).toEqual(["CARD", "MARKETPLACE"]);
    expect((await call("GET", "/auth/me", { cookie: login.cookie })).body.user.email).toBe(signup.email);
    expect((await call("GET", "/auth/me")).status).toBe(401);
    expect((await call("GET", "/auth/me", { cookie: "bsd_session=junk" })).status).toBe(401);
  });

  it("does not accept an admin-type token as a member session", async () => {
    const { signToken } = await import("../src/common/tokens.js");
    const user = await prisma.user.findUniqueOrThrow({ where: { email: signup.email } });
    expect((await call("GET", "/auth/me", { cookie: `bsd_session=${signToken("access", user.id, user.tokenVersion)}` })).status).toBe(401);
  });

  it("ends the session when the token version changes", async () => {
    const login = await call("POST", "/auth/login", { body: { email: signup.email, password: PASSWORD } });
    await prisma.user.update({ where: { email: signup.email }, data: { tokenVersion: { increment: 1 } } });
    expect((await call("GET", "/auth/me", { cookie: login.cookie })).status).toBe(401);
  });

  it("refuses postcodes outside coverage, weak passwords and duplicate emails", async () => {
    const outside = await call("POST", "/auth/register", { body: { ...signup, email: "a@test.example", postcode: "SA25 1AA" } });
    expect(outside.status).toBe(400);
    expect(outside.body.fieldErrors.postcode).toMatch(/outside/);
    expect((await call("POST", "/auth/register", { body: { ...signup, email: "b@test.example", password: "short" } })).body.fieldErrors.password).toBeTruthy();
    expect((await call("POST", "/auth/register", { body: signup })).status).toBe(409);
  });

  it("gives the same answer for a wrong password and an unknown email, and locks after 5 failures", async () => {
    const wrong = await call("POST", "/auth/login", { body: { email: signup.email, password: "not-the-password" } });
    const unknown = await call("POST", "/auth/login", { body: { email: "nobody@test.example", password: "not-the-password" } });
    expect(wrong.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    for (let i = 0; i < 4; i++) await call("POST", "/auth/login", { body: { email: signup.email, password: "wrong-password" } });
    expect((await call("POST", "/auth/login", { body: { email: signup.email, password: PASSWORD } })).status).toBe(429);
  });

  it("signs out by clearing the cookie", async () => {
    const r = await call("POST", "/auth/logout");
    expect(r.status).toBe(200);
    expect(r.setCookie).toMatch(/^bsd_session=;/);
  });
});

describe("joining a site on purpose", () => {
  const other = { ...signup, email: "other@test.example" };

  it("needs a session", async () => {
    expect((await call("POST", "/auth/modules", { body: { module: "CARD" } })).status).toBe(401);
  });

  it("adds the site once, returns the profile, and leaves other people alone", async () => {
    const a = await call("POST", "/auth/register", { body: { ...signup, email: "joiner@test.example" } });
    const b = await call("POST", "/auth/register", { body: other });
    const first = await call("POST", "/auth/modules", { body: { module: "CARD" }, cookie: a.cookie });
    expect(first.status).toBe(200);
    expect(first.body.user.modules.sort()).toEqual(["CARD", "DIRECTORY"]);
    await call("POST", "/auth/modules", { body: { module: "CARD" }, cookie: a.cookie });
    const rows = (email: string) => prisma.userModule.count({ where: { user: { email } } });
    expect(await rows("joiner@test.example")).toBe(2);
    expect(await rows(other.email)).toBe(1);
    expect((await call("GET", "/auth/me", { cookie: b.cookie })).body.user.modules).toEqual(["DIRECTORY"]);
  });

  it("rejects an unknown site or an empty body and adds nothing", async () => {
    const login = await call("POST", "/auth/login", { body: { email: other.email, password: PASSWORD } });
    const before = await prisma.userModule.count();
    expect((await call("POST", "/auth/modules", { body: { module: "BOGUS" }, cookie: login.cookie })).status).toBe(400);
    expect((await call("POST", "/auth/modules", { body: {}, cookie: login.cookie })).status).toBe(400);
    expect(await prisma.userModule.count()).toBe(before);
  });
});

describe("profile fields at sign-up", () => {
  const base = { ...signup, password: PASSWORD };

  it("stores STUDENT as a claim, with an optional phone, and gives no STUDENT badge", async () => {
    const r = await call("POST", "/auth/register", { body: { ...base, email: "student@test.example", accountType: "STUDENT", phone: "07700 900123" } });
    expect(r.status).toBe(201);
    expect(r.body.user).toMatchObject({ accountType: "STUDENT", phone: "07700 900123", studentVerified: false, listingCount: 0, badges: ["MEMBER"] });
    expect(await prisma.userBadge.count({ where: { badge: "STUDENT", user: { email: "student@test.example" } } })).toBe(0);
  });

  it("requires a valid account type and checks the phone", async () => {
    const missing = await call("POST", "/auth/register", { body: { name: "X Y", email: "m1@test.example", password: PASSWORD, postcode: "SA1 4PE" } });
    expect(missing.status).toBe(400);
    expect(missing.body.fieldErrors.accountType).toBe("Choose General or Student.");
    const bad = await call("POST", "/auth/register", { body: { ...base, email: "m2@test.example", accountType: "ADMIN" } });
    expect(bad.body.fieldErrors.accountType).toBe("Choose General or Student.");
    const phone = await call("POST", "/auth/register", { body: { ...base, email: "m3@test.example", phone: "abc" } });
    expect(phone.body.fieldErrors.phone).toBe("Enter a valid phone number.");
    const empty = await call("POST", "/auth/register", { body: { ...base, email: "m4@test.example", phone: "" } });
    expect(empty.status).toBe(201);
    expect(empty.body.user.phone).toBeNull();
    expect(await prisma.user.count({ where: { email: { in: ["m1@test.example", "m2@test.example", "m3@test.example"] } } })).toBe(0);
  });

  it("returns listingCount from the listings the member owns", async () => {
    const r = await call("POST", "/auth/register", { body: { ...base, email: "counter@test.example" } });
    const zone = await prisma.coverageZone.findFirstOrThrow();
    const cat = await prisma.category.findFirstOrThrow();
    await prisma.business.create({ data: { slug: "count-me", name: "Count Me", categoryId: cat.id, description: "d", phone: "1", postcode: "SA1 4PE", postcodeDistrict: "SA1", zoneId: zone.id, ownerUserId: r.body.user.id } });
    expect((await call("GET", "/auth/me", { cookie: r.cookie })).body.user.listingCount).toBe(1);
  });
});

describe("editing the profile", () => {
  it("needs a session", async () => {
    expect((await call("PATCH", "/auth/me", { body: { name: "Nope" } })).status).toBe(401);
  });

  it("updates name, phone, postcode and account type, and ignores the email", async () => {
    const r = await call("POST", "/auth/register", { body: { ...signup, email: "editor@test.example" } });
    const e = await call("PATCH", "/auth/me", { cookie: r.cookie, body: { name: "New Name", phone: "01639 123 456", postcode: "sa10 9aa", accountType: "STUDENT", email: "stolen@test.example" } });
    expect(e.status).toBe(200);
    expect(e.body.user).toMatchObject({ name: "New Name", phone: "01639 123 456", postcode: "SA10 9AA", accountType: "STUDENT", email: "editor@test.example" });
    const row = await prisma.user.findUniqueOrThrow({ where: { email: "editor@test.example" } });
    expect(row.postcodeDistrict).toBe("SA10");
    // phone can be cleared, and switching back to General is allowed
    const back = await call("PATCH", "/auth/me", { cookie: r.cookie, body: { phone: null, accountType: "GENERAL" } });
    expect(back.body.user).toMatchObject({ phone: null, accountType: "GENERAL" });
  });

  it("rejects an out of coverage postcode, a bad phone and a bad account type, and changes nothing", async () => {
    const login = await call("POST", "/auth/register", { body: { ...signup, email: "strict@test.example" } });
    const out = await call("PATCH", "/auth/me", { cookie: login.cookie, body: { name: "Changed", postcode: "SA25 1AA" } });
    expect(out.status).toBe(400);
    expect(out.body.fieldErrors.postcode).toMatch(/outside/);
    expect((await call("PATCH", "/auth/me", { cookie: login.cookie, body: { phone: "x" } })).status).toBe(400);
    expect((await call("PATCH", "/auth/me", { cookie: login.cookie, body: { accountType: "VIP" } })).status).toBe(400);
    expect((await call("GET", "/auth/me", { cookie: login.cookie })).body.user.name).toBe(signup.name);
  });
});

describe("changing the password", () => {
  const NEW = "Another-Strong-Passphrase-42";

  it("needs a session", async () => {
    expect((await call("POST", "/auth/password", { body: { currentPassword: PASSWORD, newPassword: NEW } })).status).toBe(401);
  });

  it("rejects a wrong current password and a weak new one, then ends old sessions and keeps this one", async () => {
    const email = "changer@test.example";
    const reg = await call("POST", "/auth/register", { body: { ...signup, email } });
    const otherDevice = await call("POST", "/auth/login", { body: { email, password: PASSWORD } });

    const wrong = await call("POST", "/auth/password", { cookie: reg.cookie, body: { currentPassword: "not-it-at-all-1", newPassword: NEW } });
    expect(wrong.status).toBe(400);
    expect(wrong.body.fieldErrors.currentPassword).toBeTruthy();
    expect((await prisma.user.findUniqueOrThrow({ where: { email } })).failedLoginCount).toBe(1);

    const weak = await call("POST", "/auth/password", { cookie: reg.cookie, body: { currentPassword: PASSWORD, newPassword: "short" } });
    expect(weak.status).toBe(400);
    expect(weak.body.fieldErrors.newPassword).toBeTruthy();

    const ok = await call("POST", "/auth/password", { cookie: reg.cookie, body: { currentPassword: PASSWORD, newPassword: NEW } });
    expect(ok.status).toBe(200);
    expect(ok.cookie).toMatch(/^bsd_session=/);
    // the cookie from before the change is dead, the new one works
    expect((await call("GET", "/auth/me", { cookie: reg.cookie })).status).toBe(401);
    expect((await call("GET", "/auth/me", { cookie: otherDevice.cookie })).status).toBe(401);
    expect((await call("GET", "/auth/me", { cookie: ok.cookie })).status).toBe(200);
    // the new password signs in, the old one does not
    expect((await call("POST", "/auth/login", { body: { email, password: NEW } })).status).toBe(200);
    expect((await call("POST", "/auth/login", { body: { email, password: PASSWORD } })).status).toBe(401);
  });

  it("locks after repeated wrong current passwords, like login", async () => {
    const email = "locker@test.example";
    const reg = await call("POST", "/auth/register", { body: { ...signup, email } });
    for (let i = 0; i < 5; i++) await call("POST", "/auth/password", { cookie: reg.cookie, body: { currentPassword: "wrong-password-1", newPassword: NEW } });
    expect((await call("POST", "/auth/password", { cookie: reg.cookie, body: { currentPassword: PASSWORD, newPassword: NEW } })).status).toBe(429);
  });
});
