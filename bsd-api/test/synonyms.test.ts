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
const tokens: Record<string, string> = {};

async function call(method: string, url: string, token?: string, body?: unknown) {
  const res = await app.inject({
    method: method as "GET",
    url,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    ...(body !== undefined ? { payload: body as object } : {}),
  });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null };
}
const search = async (q: string) => {
  const r = await call("GET", `/businesses/search?q=${encodeURIComponent(q)}&pageSize=50`);
  return { names: ((r.body.items ?? []) as { name: string }[]).map((i) => i.name).sort(), expandedFrom: r.body.expandedFrom, status: r.status };
};

beforeAll(async () => {
  t = await startTestDb();
  process.env.DATABASE_URL = t.url;
  const { PrismaClient: Client } = await import("@prisma/client");
  prisma = new Client({ datasources: { db: { url: t.url } } });
  delete process.env.SEED_ADMIN_EMAIL;
  delete process.env.SEED_ADMIN_PASSWORD;
  const { runSeed } = await import("../prisma/seed.js");
  await runSeed(prisma);

  const hash = await hashPassword(PASSWORD);
  for (const role of ["ADMIN", "MODERATOR"]) await prisma.adminUser.create({ data: { name: role, email: `${role.toLowerCase()}@t.example`, role: role as "ADMIN", passwordHash: hash } });

  const zone = await prisma.coverageZone.findUniqueOrThrow({ where: { slug: "zone-1" } });
  const health = await prisma.category.findUniqueOrThrow({ where: { slug: "health-and-care" } });
  const food = await prisma.category.findUniqueOrThrow({ where: { slug: "restaurants-and-takeaways" } });
  const base = { phone: "1", postcode: "SA1 4PE", postcodeDistrict: "SA1", zoneId: zone.id, description: "A local business." };
  await prisma.business.createMany({
    data: [
      { ...base, id: "b-cup", slug: "b-cup", name: "Cupping Clinic", categoryId: health.id, status: "APPROVED", servicesOffered: ["CuppingTherapyHijama"] },
      { ...base, id: "b-cup-pending", slug: "b-cup-pending", name: "Pending Cupping", categoryId: health.id, status: "PENDING", servicesOffered: ["CuppingTherapyHijama"] },
      { ...base, id: "b-food", slug: "b-food", name: "Spice Garden", categoryId: food.id, status: "APPROVED", servicesOffered: [] },
      { ...base, id: "b-other", slug: "b-other", name: "Plain Place", categoryId: food.id, status: "APPROVED", servicesOffered: [] },
    ],
  });
  const { buildApp } = await import("../src/server.js");
  app = buildApp({ storage: new MemoryStorage() });
  await app.ready();
  for (const role of ["ADMIN", "MODERATOR"]) {
    const res = await app.inject({ method: "POST", url: "/admin/login", payload: { email: `${role.toLowerCase()}@t.example`, password: PASSWORD } });
    tokens[role] = JSON.parse(res.body).accessToken;
  }
});

afterAll(async () => {
  await app?.close();
  await prisma?.$disconnect();
  await t?.stop();
});

describe("seed", () => {
  it("added the starter rows once, marked as starter, and a second run changes nothing", async () => {
    const n = await prisma.searchSynonym.count();
    expect(n).toBeGreaterThanOrEqual(80);
    expect(await prisma.searchSynonym.count({ where: { starter: true } })).toBe(n);
    const { runSeed } = await import("../prisma/seed.js");
    await runSeed(prisma);
    expect(await prisma.searchSynonym.count()).toBe(n);
  });
});

describe("search with synonyms", () => {
  it("finds the cupping listing by hijama, the Bangla spelling and the English words, and never the pending one", async () => {
    for (const q of ["hijama", "Hijama", "হিজামা", "cupping therapy", "কাপিং"]) {
      const r = await search(q);
      expect(r.names, q).toEqual(["Cupping Clinic"]);
    }
  });
  it("says what was added, and says nothing for an ordinary search", async () => {
    expect((await search("হিজামা")).expandedFrom).toEqual([{ term: "হিজামা", expansions: ["hijama", "cupping", "CuppingTherapy"] }]);
    const plain = await search("restaurant");
    expect(plain.expandedFrom).toEqual([]);
    expect(plain.names).toEqual(["Plain Place", "Spice Garden"]);
  });
  it("returns the same results for a word with no synonym, and handles wildcard and quote characters", async () => {
    expect((await search("garden")).names).toEqual(["Spice Garden"]);
    for (const q of ["%", "_", "'; drop table", "(a|b)*", "\\"]) expect((await search(q)).status, q).toBe(200);
    expect((await search("%%%")).names).toEqual([]);
  });
  it("maps a term to a category", async () => {
    const food = await prisma.category.findUniqueOrThrow({ where: { slug: "restaurants-and-takeaways" } });
    await prisma.searchSynonym.create({ data: { term: "khabar-test", expansions: ["zzzunmatched"], categoryId: food.id } });
    const { clearSynonymCache } = await import("../src/common/search.js");
    clearSynonymCache();
    expect((await search("khabar-test")).names).toEqual(["Plain Place", "Spice Garden"]);
  });
});

describe("admin synonyms", () => {
  it("needs an admin sign in and the ADMIN role", async () => {
    expect((await call("GET", "/admin/synonyms")).status).toBe(401);
    expect((await call("GET", "/admin/synonyms", tokens.MODERATOR)).status).toBe(403);
    expect((await call("POST", "/admin/synonyms", tokens.MODERATOR, { term: "x", expansions: ["yy"] })).status).toBe(403);
    expect((await call("GET", "/admin/synonyms", tokens.ADMIN)).status).toBe(200);
  });

  it("creates, edits and deletes with audit entries, and the search sees each change at once", async () => {
    const A = tokens.ADMIN;
    const created = await call("POST", "/admin/synonyms", A, { term: "  ঝাল Food ", expansions: ["#Spice Garden", "garden"] });
    expect(created.status).toBe(201);
    expect(created.body.term).toBe("ঝাল food");
    expect(created.body.expansions).toEqual(["Spice Garden", "garden"]);
    expect(created.body.starter).toBe(false);
    expect((await search("ঝাল food")).names).toEqual(["Spice Garden"]);

    const dup = await call("POST", "/admin/synonyms", A, { term: "ঝাল FOOD", expansions: ["abc"] });
    expect(dup.status).toBe(409);

    const edited = await call("PATCH", `/admin/synonyms/${created.body.id}`, A, { expansions: ["plain place"] });
    expect(edited.status).toBe(200);
    expect((await search("ঝাল food")).names).toEqual(["Plain Place"]);

    expect((await call("DELETE", `/admin/synonyms/${created.body.id}`, A)).status).toBe(200);
    expect((await search("ঝাল food")).names).toEqual([]);
    expect((await call("DELETE", `/admin/synonyms/${created.body.id}`, A)).status).toBe(404);

    const actions = (await prisma.auditLog.findMany({ where: { entityType: "SearchSynonym" }, orderBy: { createdAt: "asc" } })).map((a) => a.action);
    expect(actions).toEqual(["CREATE_SYNONYM", "UPDATE_SYNONYM", "DELETE_SYNONYM"]);
  });

  it("clears the starter flag when a person edits a starter row", async () => {
    const row = await prisma.searchSynonym.findFirstOrThrow({ where: { starter: true } });
    const r = await call("PATCH", `/admin/synonyms/${row.id}`, tokens.ADMIN, { expansions: ["edited word"] });
    expect(r.body.starter).toBe(false);
  });

  it("rejects bad input", async () => {
    const A = tokens.ADMIN;
    const bad = async (b: unknown, field: string) => {
      const r = await call("POST", "/admin/synonyms", A, b);
      expect(r.status, JSON.stringify(b)).toBe(400);
      expect(r.body.fieldErrors[field]).toBeTruthy();
    };
    await bad({ term: "", expansions: ["aa"] }, "term");
    await bad({ term: "a".repeat(61), expansions: ["aa"] }, "term");
    await bad({ term: "no$pe", expansions: ["aa"] }, "term");
    await bad({ term: "ok", expansions: [] }, "expansions");
    await bad({ term: "ok", expansions: Array.from({ length: 9 }, (_, i) => "word" + i) }, "expansions");
    await bad({ term: "ok", expansions: ["a"] }, "expansions");
    await bad({ term: "ok", expansions: ["OK"] }, "expansions");
    await bad({ term: "ok", expansions: ["fine"], categoryId: "nope" }, "categoryId");
  });

  it("import: a dry run writes nothing, apply is refused with a bad line, then applies", async () => {
    const A = tokens.ADMIN;
    const before = await prisma.searchSynonym.count();
    const text = "tarkari-x | vegetables, curry | restaurants-and-takeaways\nmudi | grocery shop\n";
    const dry = await call("POST", "/admin/synonyms/import", A, { text, apply: false });
    expect(dry.body).toMatchObject({ applied: false, created: 1, updated: 1, errors: 0 });
    expect(dry.body.lines[0].matches).toBe(2);
    expect(await prisma.searchSynonym.count()).toBe(before);

    const bad = await call("POST", "/admin/synonyms/import", A, { text: text + "oops no bars\nzz | q | nope-slug", apply: true });
    expect(bad.status).toBe(400);
    expect(bad.body.errors).toBe(2);
    expect(await prisma.searchSynonym.count()).toBe(before);

    const ok = await call("POST", "/admin/synonyms/import", A, { text, apply: true });
    expect(ok.body).toMatchObject({ applied: true, created: 1, updated: 1 });
    expect(await prisma.searchSynonym.count()).toBe(before + 1);
    expect((await prisma.searchSynonym.findUniqueOrThrow({ where: { term: "mudi" } })).expansions).toEqual(["grocery shop"]);
    expect(await prisma.auditLog.count({ where: { action: "IMPORT_SYNONYMS" } })).toBe(1);
  });

  it("import limit: 500 lines", async () => {
    const text = Array.from({ length: 501 }, (_, i) => `w${i} | word${i}`).join("\n");
    expect((await call("POST", "/admin/synonyms/import", tokens.ADMIN, { text })).status).toBe(400);
  });
});
