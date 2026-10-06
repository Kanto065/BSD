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
const signup = { name: "Test Member", email: "member@test.example", password: PASSWORD, postcode: "sa1 4pe" };

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
