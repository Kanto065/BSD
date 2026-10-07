import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { startTestDb, type TestDb } from "./helpers/testdb.js";
import { MemoryStorage } from "../src/common/storage.js";
import { hashPassword } from "../src/common/passwords.js";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 240_000 });
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-hs256-signing";

let t: TestDb;
let prisma: PrismaClient;
let app: FastifyInstance;
const PASSWORD = "Correct-Horse-Battery-77";

async function call(method: string, url: string, opts: { body?: unknown; cookie?: string } = {}) {
  const res = await app.inject({
    method: method as "GET",
    url,
    headers: opts.cookie ? { cookie: opts.cookie } : {},
    ...(opts.body !== undefined ? { payload: opts.body as object } : {}),
  });
  const raw = res.headers["set-cookie"];
  const setCookie = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null, cookie: setCookie ? setCookie.split(";")[0] : undefined };
}

// A directory-only member: signed up on bsd.wales, never joined Pass or Marketplace.
async function makeMember(email: string) {
  await prisma.user.create({
    data: { name: "Mod Member", email, passwordHash: await hashPassword(PASSWORD), postcode: "SA1 4PE", postcodeDistrict: "SA1", modules: { create: { module: "DIRECTORY" } } },
  });
  const login = await call("POST", "/auth/login", { body: { email, password: PASSWORD } });
  return login.cookie!;
}

beforeAll(async () => {
  t = await startTestDb();
  process.env.DATABASE_URL = t.url;
  const { PrismaClient: Client } = await import("@prisma/client");
  prisma = new Client({ datasources: { db: { url: t.url } } });
  const { buildApp } = await import("../src/server.js");
  app = buildApp({ storage: new MemoryStorage() });
  // Probe routes: no real route uses the gate yet.
  // Registered as a plugin so it runs after the auth plugin has decorated the app.
  app.register(async (i) => {
    i.get("/_probe/card", { preHandler: i.requireModule("CARD") }, async (req) => ({ id: req.user!.id }));
    i.get("/_probe/market", { preHandler: i.requireModule("MARKETPLACE") }, async (req) => ({ id: req.user!.id }));
  });
  await app.ready();
});

afterAll(async () => {
  await app?.close();
  await prisma?.$disconnect();
  await t?.stop();
});

describe("requireModule", () => {
  it("401 when signed out", async () => {
    expect((await call("GET", "/_probe/card")).status).toBe(401);
  });

  it("403 when the module was never joined, with the module's own message", async () => {
    const cookie = await makeMember("never@test.example");
    const card = await call("GET", "/_probe/card", { cookie });
    expect(card.status).toBe(403);
    expect(card.body.error).toBe("Join Privilege Pass to use this.");
    const market = await call("GET", "/_probe/market", { cookie });
    expect(market.status).toBe(403);
    expect(market.body.error).toBe("Join the Marketplace to use this.");
  });

  it("200 after joining, and a different module is still 403", async () => {
    const cookie = await makeMember("joined@test.example");
    expect((await call("POST", "/auth/modules", { cookie, body: { module: "CARD" } })).status).toBe(200);
    expect((await call("GET", "/_probe/card", { cookie })).status).toBe(200);
    expect((await call("GET", "/_probe/market", { cookie })).status).toBe(403);
  });

  it("rejects a deleted user even with the row and an old cookie", async () => {
    const cookie = await makeMember("gone@test.example");
    await call("POST", "/auth/modules", { cookie, body: { module: "CARD" } });
    await prisma.user.update({ where: { email: "gone@test.example" }, data: { deletedAt: new Date() } });
    expect((await call("GET", "/_probe/card", { cookie })).status).toBe(401);
  });
});
