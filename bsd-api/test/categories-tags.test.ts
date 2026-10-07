import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { startTestDb, type TestDb } from "./helpers/testdb.js";
import { hashPassword } from "../src/common/passwords.js";
import { CATEGORIES } from "../prisma/seed-data.js";
import { cleanTag, serviceTagsInput } from "../src/common/service-tags.js";

// M9-B: the 24 category directory with service tags. Staged categories (18 to 24) stay out of every public list until
// an admin unlocks them, listings already in a category stay visible, and the tag editor validates on the server.

vi.setConfig({ testTimeout: 60_000, hookTimeout: 240_000 });
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-hs256-signing";

let t: TestDb;
let prisma: PrismaClient;
let app: FastifyInstance;
let admin = "";
let mod = "";

const PASSWORD = "Correct-Horse-Battery-77";
const STAGED_SLUG = "digital-services-and-it-solutions";

async function call(method: string, url: string, body?: unknown, tk = admin) {
  const res = await app.inject({
    method: method as "GET",
    url,
    headers: tk ? { authorization: `Bearer ${tk}` } : {},
    ...(body !== undefined ? { payload: body as object } : {}),
  });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null };
}
const publicSlugs = async () => ((await call("GET", "/categories", undefined, "")).body.categories as { slug: string }[]).map((c) => c.slug);
const stagedRow = () => prisma.category.findUniqueOrThrow({ where: { slug: STAGED_SLUG } });

beforeAll(async () => {
  t = await startTestDb();
  process.env.DATABASE_URL = t.url;
  const { PrismaClient: Client } = await import("@prisma/client");
  prisma = new Client({ datasources: { db: { url: t.url } } });
  delete process.env.SEED_ADMIN_EMAIL;
  const { runSeed } = await import("../prisma/seed.js");
  await runSeed(prisma);
  const hash = await hashPassword(PASSWORD);
  await prisma.adminUser.create({ data: { name: "Admin", email: "admin@test.example", role: "ADMIN", passwordHash: hash } });
  await prisma.adminUser.create({ data: { name: "Mod", email: "mod@test.example", role: "MODERATOR", passwordHash: hash } });
  const { buildApp } = await import("../src/server.js");
  app = buildApp();
  await app.ready();
  const login = async (email: string) =>
    (JSON.parse((await app.inject({ method: "POST", url: "/admin/login", payload: { email, password: PASSWORD } })).body) as { accessToken: string }).accessToken;
  admin = await login("admin@test.example");
  mod = await login("mod@test.example");
});

afterAll(async () => {
  await app?.close();
  await prisma?.$disconnect();
  await t?.stop();
});

describe("the seeded directory", () => {
  it("has 25 rows, 7 of them staged, and the staged flag and tags come from the document", async () => {
    const rows = await prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
    expect(rows.map((r) => r.name)).toEqual(CATEGORIES.map((c) => c.name));
    expect(rows.filter((r) => r.staged)).toHaveLength(7);
    expect(rows.find((r) => r.slug === "groceries-and-halal")!.serviceTags).toEqual(CATEGORIES[0]!.serviceTags);
  });

  it("running the seed again changes nothing", async () => {
    const { runSeed } = await import("../prisma/seed.js");
    const snap = async () => ({
      c: await prisma.category.findMany({ orderBy: { slug: "asc" }, include: { subcategories: { orderBy: { slug: "asc" } } } }),
    });
    const before = await snap();
    await runSeed(prisma);
    expect(await snap()).toEqual(before);
    process.env.SEED_TAXONOMY = "reset";
    try {
      await runSeed(prisma);
    } finally {
      delete process.env.SEED_TAXONOMY;
    }
    expect(await snap()).toEqual(before);
  });

  it("a reset renames an old category in place, so its listing stays attached", async () => {
    const zone = await prisma.coverageZone.findFirstOrThrow();
    const cat = await prisma.category.findUniqueOrThrow({ where: { slug: "groceries-and-halal" } });
    const biz = await prisma.business.create({
      data: { slug: "reset-shop", name: "Reset Shop", categoryId: cat.id, description: "d", phone: "1", postcode: "SA1 4PE", postcodeDistrict: "SA1", zoneId: zone.id, status: "APPROVED", servicesOffered: [] },
    });
    await prisma.category.update({ where: { id: cat.id }, data: { name: "Groceries & Halal", serviceTags: [] } });
    process.env.SEED_TAXONOMY = "reset";
    try {
      const { runSeed } = await import("../prisma/seed.js");
      await runSeed(prisma);
    } finally {
      delete process.env.SEED_TAXONOMY;
    }
    const after = await prisma.category.findUniqueOrThrow({ where: { slug: "groceries-and-halal" } });
    expect(after.id).toBe(cat.id);
    expect(after.name).toBe("Grocery, Halal Meat & Cash Carry");
    expect(after.serviceTags).toEqual(CATEGORIES[0]!.serviceTags);
    expect((await prisma.business.findUniqueOrThrow({ where: { id: biz.id } })).categoryId).toBe(cat.id);
    await prisma.business.delete({ where: { id: biz.id } });
  });
});

describe("staged categories on the public site", () => {
  it("lists categories 1 to 17 and Others, never a staged one, in order, with their tags", async () => {
    const res = (await call("GET", "/categories", undefined, "")).body.categories as { slug: string; name: string; serviceTags: string[]; subcategories: { name: string }[] }[];
    expect(res).toHaveLength(18);
    expect(res.map((c) => c.slug)).toEqual(CATEGORIES.filter((c) => !c.staged).map((c) => c.slug));
    expect(res[0]!.serviceTags).toContain("FreshHalalMeat");
    expect(res[0]!.subcategories.map((s) => s.name)).toEqual(CATEGORIES[0]!.subcategories);
  });

  it("answers 404 for a staged category page, by its address, in the public API", async () => {
    expect((await call("GET", `/categories/${STAGED_SLUG}`, undefined, "")).status).toBe(404);
    expect((await call("GET", "/categories/groceries-and-halal", undefined, "")).status).toBe(200);
  });

  it("shows staged categories to the admin, with the flag and the tags", async () => {
    const r = (await call("GET", "/admin/categories")).body.categories as { slug: string; staged: boolean; serviceTags: string[] }[];
    expect(r.filter((c) => c.staged)).toHaveLength(7);
    expect(r.find((c) => c.slug === STAGED_SLUG)!.serviceTags).toContain("CyberSecurity");
  });

  it("unlocks a category from the admin, it appears at once, and hides again, with an audit entry each time", async () => {
    const c = await stagedRow();
    expect((await call("PATCH", `/admin/categories/${c.id}`, { staged: false })).body).toEqual({ ok: true, changed: ["staged"] });
    expect(await publicSlugs()).toContain(STAGED_SLUG);
    expect((await call("GET", `/categories/${STAGED_SLUG}`, undefined, "")).status).toBe(200);
    expect((await call("PATCH", `/admin/categories/${c.id}`, { staged: true })).status).toBe(200);
    expect(await publicSlugs()).not.toContain(STAGED_SLUG);
    expect(await prisma.auditLog.count({ where: { action: "EDIT_CATEGORY", entityId: c.id } })).toBe(2);
    // sending the same value again is a no-op and writes no audit entry
    expect((await call("PATCH", `/admin/categories/${c.id}`, { staged: true })).body).toEqual({ ok: true, changed: [] });
    expect(await prisma.auditLog.count({ where: { action: "EDIT_CATEGORY", entityId: c.id } })).toBe(2);
  });

  it("keeps a listing visible when its category is staged, only the category leaves the lists", async () => {
    const zone = await prisma.coverageZone.findFirstOrThrow();
    const cat = await prisma.category.findUniqueOrThrow({ where: { slug: "mobile-and-tech-repair" } });
    const biz = await prisma.business.create({
      data: { slug: "staged-listing", name: "Staged Phone Repair", categoryId: cat.id, description: "d", phone: "1", postcode: "SA1 4PE", postcodeDistrict: "SA1", zoneId: zone.id, status: "APPROVED", servicesOffered: ["Repairs"] },
    });
    await call("PATCH", `/admin/categories/${cat.id}`, { staged: true });
    try {
      expect((await call("GET", "/businesses/staged-listing", undefined, "")).status).toBe(200);
      expect((await call("GET", "/businesses/search?q=staged+phone", undefined, "")).body.total).toBe(1);
      expect(await publicSlugs()).not.toContain("mobile-and-tech-repair");
      expect((await call("GET", "/categories/mobile-and-tech-repair", undefined, "")).status).toBe(404);
    } finally {
      await call("PATCH", `/admin/categories/${cat.id}`, { staged: false });
      await prisma.business.delete({ where: { id: biz.id } });
    }
  });
});

describe("tag editor validation", () => {
  it("accepts a list or text separated by commas, spaces and new lines, strips #, drops repeats", async () => {
    const c = await stagedRow();
    const r = await call("PATCH", `/admin/categories/${c.id}`, { serviceTags: "#SEO, #WebDesign\n#seo  CloudHosting" });
    expect(r.status).toBe(200);
    expect((await stagedRow()).serviceTags).toEqual(["SEO", "WebDesign", "CloudHosting"]);
    expect((await call("PATCH", `/admin/categories/${c.id}`, { serviceTags: ["Alpha", "#Beta"] })).status).toBe(200);
    expect((await stagedRow()).serviceTags).toEqual(["Alpha", "Beta"]);
    // clearing is allowed
    expect((await call("PATCH", `/admin/categories/${c.id}`, { serviceTags: "" })).status).toBe(200);
    expect((await stagedRow()).serviceTags).toEqual([]);
  });

  it("rejects a bad tag, a too short or too long one, and more than 20, and changes nothing", async () => {
    const c = await stagedRow();
    await call("PATCH", `/admin/categories/${c.id}`, { serviceTags: "Keep" });
    for (const bad of ["a", "x".repeat(41), "has-dash", "Bad!", Array.from({ length: 21 }, (_, i) => `Tag${i + 10}`).join(",")]) {
      const r = await call("PATCH", `/admin/categories/${c.id}`, { serviceTags: bad });
      expect(r.status, bad).toBe(400);
      expect(r.body.fieldErrors.serviceTags, bad).toBeTruthy();
    }
    expect((await stagedRow()).serviceTags).toEqual(["Keep"]);
    await call("PATCH", `/admin/categories/${c.id}`, { serviceTags: CATEGORIES[17]!.serviceTags });
  });

  it("needs an ADMIN, a moderator and a visitor are turned away", async () => {
    const c = await stagedRow();
    expect((await call("PATCH", `/admin/categories/${c.id}`, { staged: false }, mod)).status).toBe(403);
    expect((await call("PATCH", `/admin/categories/${c.id}`, { staged: false }, "")).status).toBe(401);
    expect((await stagedRow()).staged).toBe(true);
  });

  it("takes tags when a category is created, hidden by default", async () => {
    const r = await call("POST", "/admin/categories", { name: "Test Tag Category", serviceTags: "One1, Two2" });
    expect(r.status).toBe(201);
    const row = await prisma.category.findUniqueOrThrow({ where: { slug: "test-tag-category" } });
    expect(row.serviceTags).toEqual(["One1", "Two2"]);
    expect(row.staged).toBe(false);
    await prisma.category.delete({ where: { id: row.id } });
  });

  it("cleanTag and the input schema agree", () => {
    expect(cleanTag("#Halal")).toBe("Halal");
    expect(cleanTag("H")).toBeNull();
    expect(serviceTagsInput.safeParse("A1,B2").success).toBe(true);
    expect(serviceTagsInput.safeParse("A1,b").success).toBe(false);
  });
});
