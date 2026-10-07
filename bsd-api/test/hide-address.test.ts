import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { startTestDb, type TestDb } from "./helpers/testdb.js";
import { MemoryStorage } from "../src/common/storage.js";
import { hashPassword } from "../src/common/passwords.js";
import { areaLabel, hidesAddress } from "../src/common/public.js";

// M9-A: a listing can hide its street and full postcode. Every public body must then carry neither.

vi.setConfig({ testTimeout: 60_000, hookTimeout: 240_000 });
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-hs256-signing";

let t: TestDb;
let prisma: PrismaClient;
let app: FastifyInstance;
let adminToken = "";

const PASSWORD = "Correct-Horse-Battery-77";
const STREET = "77 Secret Lane";
const POSTCODE = "SA1 4PE";
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

async function call(method: string, url: string, opts: { body?: unknown; cookie?: string; token?: string } = {}) {
  const res = await app.inject({
    method: method as "GET",
    url,
    headers: { ...(opts.cookie ? { cookie: opts.cookie } : {}), ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
    ...(opts.body !== undefined ? { payload: opts.body as object } : {}),
  });
  const raw = res.headers["set-cookie"];
  const setCookie = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  return { status: res.statusCode, text: res.body, body: res.body ? JSON.parse(res.body) : null, cookie: setCookie ? setCookie.split(";")[0] : undefined };
}

let n = 0;
async function makeListing(over: Record<string, unknown> = {}, localities: string[] = []) {
  const zone = await prisma.coverageZone.findUniqueOrThrow({ where: { slug: "zone-1" } });
  const category = await prisma.category.findFirstOrThrow({ where: { status: "APPROVED", requiresOwnerName: false } });
  const locs = await prisma.locality.findMany({ where: { slug: { in: localities } } });
  return prisma.business.create({
    data: {
      slug: `hide-test-${++n}`,
      name: `Hide Test ${n}`,
      categoryId: category.id,
      description: `We run a small shop and serve the neighbourhood every day. ${words(30)}`,
      servicesOffered: ["Bread"],
      phone: "01792 123 456",
      address: STREET,
      postcode: POSTCODE,
      postcodeDistrict: "SA1",
      zoneId: zone.id,
      otherAreaText: "Around Swansea",
      status: "APPROVED",
      localities: { create: locs.map((l) => ({ localityId: l.id })) },
      ...over,
    },
  });
}

/** Every public body that can show a listing. */
const publicUrls = (slug: string, name: string, category: string) => [
  `/businesses/${slug}`,
  `/businesses/search?q=${encodeURIComponent(name)}`,
  "/businesses/search?pageSize=50",
  "/businesses/featured?limit=24",
  `/categories/${category}?pageSize=50`,
  "/zones/zone-1?pageSize=50",
];

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
  adminToken = (await call("POST", "/admin/login", { body: { email: "admin@test.example", password: PASSWORD } })).body.accessToken;
});

afterAll(async () => {
  await app?.close();
  await prisma?.$disconnect();
  await t?.stop();
});

describe("areaLabel", () => {
  const loc = (name: string) => ({ locality: { name } });
  it("uses the locality only when exactly one is chosen", () => {
    expect(areaLabel({ postcodeDistrict: "SA5", localities: [loc("Manselton")] })).toBe("Manselton, SA5");
    expect(areaLabel({ postcodeDistrict: "SA5", localities: [] })).toBe("SA5");
    expect(areaLabel({ postcodeDistrict: "SA5", localities: [loc("Manselton"), loc("Brynhyfryd")] })).toBe("SA5");
  });

  it("hidesAddress is the flag or the HomeBased word or no address", () => {
    expect(hidesAddress({ hideFullAddress: true, address: STREET })).toBe(true);
    expect(hidesAddress({ hideFullAddress: false, address: STREET })).toBe(false);
    expect(hidesAddress({ hideFullAddress: false, address: "HomeBased" })).toBe(true);
    expect(hidesAddress({ hideFullAddress: false, address: null })).toBe(true);
  });
});

describe("public responses", () => {
  it("a hidden listing shows no street and no full postcode anywhere, and gets an areaLabel", async () => {
    const b = await makeListing({ hideFullAddress: true }, ["neath-town-centre"]);
    const cat = (await prisma.category.findUniqueOrThrow({ where: { id: b.categoryId } })).slug;
    for (const url of publicUrls(b.slug, b.name, cat)) {
      const r = await call("GET", url);
      expect(r.status, url).toBe(200);
      expect(r.text, url).not.toContain(STREET);
      expect(r.text, url).not.toContain(POSTCODE);
      expect(r.text, url).not.toContain("hideFullAddress");
    }
    const d = (await call("GET", `/businesses/${b.slug}`)).body;
    expect(d).toMatchObject({ address: null, postcode: null, postcodeDistrict: "SA1", areaLabel: "Neath Town Centre, SA1" });
    const listed = (await call("GET", `/businesses/search?q=${encodeURIComponent(b.name)}`)).body.items[0];
    expect(listed).toMatchObject({ address: null, postcode: null, areaLabel: "Neath Town Centre, SA1" });
  });

  it("falls back to the district alone with no locality or two", async () => {
    const none = await makeListing({ hideFullAddress: true });
    const two = await makeListing({ hideFullAddress: true }, ["neath-town-centre", "skewen"]);
    expect((await call("GET", `/businesses/${none.slug}`)).body.areaLabel).toBe("SA1");
    expect((await call("GET", `/businesses/${two.slug}`)).body.areaLabel).toBe("SA1");
  });

  it("the HomeBased word still hides", async () => {
    const b = await makeListing({ address: "HomeBased" });
    expect((await call("GET", `/businesses/${b.slug}`)).body).toMatchObject({ address: null, postcode: null, areaLabel: "SA1" });
  });

  it("a listing that does not hide shows as before and has no areaLabel", async () => {
    const b = await makeListing();
    expect((await call("GET", `/businesses/${b.slug}`)).body).toMatchObject({ address: STREET, postcode: POSTCODE, areaLabel: null });
  });

  it("admin detail always has the real address", async () => {
    const b = await makeListing({ hideFullAddress: true });
    const r = await call("GET", `/admin/listings/${b.id}`, { token: adminToken });
    expect(r.body.listing ?? r.body).toMatchObject({ address: STREET, postcode: POSTCODE, hideFullAddress: true });
  });
});

describe("editing the flag", () => {
  it("admin edit toggles it and the public detail follows", async () => {
    const b = await makeListing();
    const edit = (body: object) => call("PATCH", `/admin/listings/${b.id}`, { token: adminToken, body });
    expect((await edit({ hideFullAddress: true })).status).toBe(200);
    expect((await call("GET", `/businesses/${b.slug}`)).text).not.toContain(STREET);
    expect((await edit({ hideFullAddress: "yes" })).status).toBe(400);
    expect((await edit({ hideFullAddress: false })).status).toBe(200);
    expect((await call("GET", `/businesses/${b.slug}`)).body.address).toBe(STREET);
  });

  it("owner PATCH toggles it, refuses a non boolean, and the public detail follows", async () => {
    const reg = await call("POST", "/auth/register", {
      body: { name: "Owner Person", email: "hide-owner@test.example", password: PASSWORD, postcode: POSTCODE, accountType: "GENERAL" },
    });
    const cookie = reg.cookie!;
    const b = await makeListing({ ownerUserId: reg.body.user.id });
    const patch = (body: object) => call("PATCH", `/auth/listings/${b.id}`, { cookie, body });
    const on = await patch({ hideFullAddress: true });
    expect(on.status).toBe(200);
    expect(on.body.listing).toMatchObject({ hideFullAddress: true, address: STREET });
    const pub = await call("GET", `/businesses/${b.slug}`);
    expect(pub.text).not.toContain(STREET);
    expect(pub.text).not.toContain(POSTCODE);
    expect((await patch({ hideFullAddress: "true" })).status).toBe(400);
    await patch({ hideFullAddress: false });
    expect((await call("GET", `/businesses/${b.slug}`)).body.address).toBe(STREET);
  });

  it("the saved business profile accepts the flag", async () => {
    const reg = await call("POST", "/auth/register", {
      body: { name: "Draft Person", email: "hide-draft@test.example", password: PASSWORD, postcode: POSTCODE, accountType: "GENERAL" },
    });
    const put = await call("PUT", "/auth/business-profile", { cookie: reg.cookie, body: { data: { hideFullAddress: true }, step: 1 } });
    expect(put.status).toBe(200);
    expect((await call("GET", "/auth/business-profile", { cookie: reg.cookie })).body.data).toEqual({ hideFullAddress: true });
  });
});
