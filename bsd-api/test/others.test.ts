import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { startTestDb, type TestDb } from "./helpers/testdb.js";
import { MemoryStorage } from "../src/common/storage.js";
import { hashPassword } from "../src/common/passwords.js";

// The "Others" category flow: typed text on Submit, the pending category staying out of every public route, and the
// admin approve, merge and reject actions.

vi.setConfig({ testTimeout: 60_000, hookTimeout: 240_000 });
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-hs256-signing";

let t: TestDb;
let prisma: PrismaClient;
let app: FastifyInstance;
let token = "";
let modToken = "";
let ipCounter = 0;

const PASSWORD = "Correct-Horse-Battery-77";
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
const CONSENTS = ["consentAccurateInfo", "consentPublishPermission", "consentNoLiability", "consentDataStorage", "gdprConsentStorage", "gdprConsentRights"];

async function submit(overrides: Record<string, string | null> = {}) {
  const base: Record<string, string> = {
    name: "Rina Henna Art",
    description: `Bridal henna and party designs. ${words(40)}`,
    servicesOffered: "Henna",
    phone: "01639 123 456",
    postcode: "SA10 9AA",
    serveZones: "zone-2",
    ...Object.fromEntries(CONSENTS.map((c) => [c, "true"])),
  };
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null) delete base[k];
    else base[k] = v;
  }
  const boundary = "----others" + Math.random().toString(16).slice(2);
  const payload = Object.entries(base)
    .map(([k, v]) => `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`)
    .join("") + `--${boundary}--\r\n`;
  const res = await app.inject({
    method: "POST",
    url: "/businesses/submit",
    payload,
    headers: { "content-type": `multipart/form-data; boundary=${boundary}`, "x-forwarded-for": `10.9.0.${++ipCounter}` },
  });
  return { status: res.statusCode, body: JSON.parse(res.body) };
}

async function call(method: string, url: string, body?: unknown, tk = token) {
  const res = await app.inject({
    method: method as "GET",
    url,
    headers: tk ? { authorization: `Bearer ${tk}` } : {},
    ...(body !== undefined ? { payload: body as object } : {}),
  });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null };
}

const category = (name: string) => prisma.category.findFirst({ where: { name } });

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
  const { buildApp } = (await import("../src/server.js")) as { buildApp: (o: { storage: MemoryStorage }) => FastifyInstance };
  app = buildApp({ storage: new MemoryStorage() });
  await app.ready();
  const login = async (email: string) =>
    (JSON.parse((await app.inject({ method: "POST", url: "/admin/login", payload: { email, password: PASSWORD } })).body) as { accessToken: string }).accessToken;
  token = await login("admin@test.example");
  modToken = await login("mod@test.example");
});

afterAll(async () => {
  await app?.close();
  await prisma?.$disconnect();
  await t?.stop();
});

describe("Others on Submit", () => {
  it("creates a PENDING category that the public site does not show, and keeps the listing out of public routes", async () => {
    const r = await submit({ customCategory: "Henna Artists" });
    expect(r.status).toBe(201);
    const c = (await category("Henna Artists"))!;
    expect(c.status).toBe("PENDING");
    expect(c.slug).toBe("henna-artists");
    expect(c.submittedAt).not.toBeNull();
    const listing = await prisma.business.findFirstOrThrow({ where: { categoryId: c.id } });
    expect(listing.status).toBe("PENDING");

    const names = ((await call("GET", "/categories", undefined, "")).body.categories as { slug: string }[]).map((x) => x.slug);
    expect(names).not.toContain("henna-artists");
    expect((await call("GET", "/categories/henna-artists", undefined, "")).status).toBe(404);

    // Even if the listing were approved in the database, it stays hidden while its category is pending.
    await prisma.business.update({ where: { id: listing.id }, data: { status: "APPROVED" } });
    expect((await call("GET", `/businesses/${listing.slug}`, undefined, "")).status).toBe(404);
    expect(((await call("GET", "/businesses/sitemap", undefined, "")).body.items as { slug: string }[]).map((i) => i.slug)).not.toContain(listing.slug);
    expect((await call("GET", "/businesses/search?q=henna", undefined, "")).body.total).toBe(0);
    // The admin approve button refuses until the category is settled.
    await prisma.business.update({ where: { id: listing.id }, data: { status: "PENDING" } });
    expect((await call("PATCH", `/admin/listings/${listing.id}/approve`)).status).toBe(409);
  });

  it("reuses an existing category with the same name in any case instead of creating a duplicate", async () => {
    const before = await prisma.category.count();
    expect((await submit({ customCategory: "henna ARTISTS" })).status).toBe(201);
    expect((await submit({ customCategory: "restaurants and takeaways" })).status).toBe(201);
    expect(await prisma.category.count()).toBe(before);
    const approved = await prisma.category.findUniqueOrThrow({ where: { slug: "restaurants-and-takeaways" } });
    expect(await prisma.business.count({ where: { categoryId: approved.id, name: "Rina Henna Art" } })).toBe(1);
  });

  it("validates the typed text and requires a real category otherwise", async () => {
    const long = await submit({ customCategory: "x".repeat(61) });
    expect(long.status).toBe(400);
    expect(long.body.fieldErrors.customCategory).toBeTruthy();
    const symbols = await submit({ customCategory: "!!!" });
    expect(symbols.status).toBe(400);
    expect(symbols.body.fieldErrors.customCategory).toBeTruthy();
    const none = await submit();
    expect(none.status).toBe(400);
    expect(none.body.fieldErrors.category).toBeTruthy();
    // a pending category cannot be picked by its slug
    const bySlug = await submit({ category: "henna-artists" });
    expect(bySlug.status).toBe(400);
    expect(bySlug.body.fieldErrors.category).toBeTruthy();
  });

  it("stops new suggestions once too many categories are waiting", async () => {
    const { MAX_PENDING_CATEGORIES } = await import("../src/modules/businesses/businesses.submit.js");
    const waiting = await prisma.category.count({ where: { status: "PENDING" } });
    for (let i = waiting; i < MAX_PENDING_CATEGORIES; i++) await prisma.category.create({ data: { name: `Filler ${i}`, slug: `filler-${i}`, status: "PENDING" } });
    const r = await submit({ customCategory: "One Too Many" });
    expect(r.status).toBe(400);
    expect(r.body.fieldErrors.customCategory).toBeTruthy();
    await prisma.category.deleteMany({ where: { slug: { startsWith: "filler-" } } });
  });
});

describe("admin moderation of Others", () => {
  it("needs an admin and lists status and sample listings", async () => {
    const c = (await category("Henna Artists"))!;
    expect((await call("POST", `/admin/categories/${c.id}/approve`, {}, modToken)).status).toBe(403);
    expect((await call("POST", `/admin/categories/${c.id}/merge`, { targetId: "x" }, "")).status).toBe(401);
    const list = (await call("GET", "/admin/categories")).body.categories as { name: string; status: string; sampleListings: unknown[] }[];
    const row = list.find((x) => x.name === "Henna Artists")!;
    expect(row.status).toBe("PENDING");
    expect(row.sampleListings.length).toBeGreaterThan(0);
  });

  it("approves a category, with a corrected name, and it goes public", async () => {
    const c = (await category("Henna Artists"))!;
    expect((await call("POST", `/admin/categories/${c.id}/approve`, { name: "Henna and Mehndi" })).status).toBe(200);
    const after = await prisma.category.findUniqueOrThrow({ where: { id: c.id } });
    expect(after).toMatchObject({ status: "APPROVED", name: "Henna and Mehndi", slug: "henna-and-mehndi" });
    expect((await call("GET", "/categories/henna-and-mehndi", undefined, "")).status).toBe(200);
    expect((await call("POST", `/admin/categories/${c.id}/approve`, {})).status).toBe(409);
    expect(await prisma.auditLog.count({ where: { action: "APPROVE_CATEGORY", entityId: c.id } })).toBe(1);
  });

  it("merges into an existing category as a new subcategory, moving listings and subcategories", async () => {
    await submit({ customCategory: "Mehndi Parties" });
    const src = (await category("Mehndi Parties"))!;
    await prisma.subcategory.create({ data: { name: "Bridal", slug: "mehndi-parties-bridal", categoryId: src.id } });
    const target = await prisma.category.findUniqueOrThrow({ where: { slug: "henna-and-mehndi" } });
    await prisma.subcategory.create({ data: { name: "bridal", slug: "henna-and-mehndi-bridal", categoryId: target.id } });
    await prisma.subcategory.create({ data: { name: "Kids", slug: "mehndi-parties-kids", categoryId: src.id } });

    expect((await call("POST", `/admin/categories/${src.id}/merge`, { targetId: src.id })).status).toBe(400);
    const r = await call("POST", `/admin/categories/${src.id}/merge`, { targetId: target.id, newSubcategoryName: "Parties" });
    expect(r.status).toBe(200);
    expect(r.body.movedListings).toBe(1);
    expect(await prisma.category.findUnique({ where: { id: src.id } })).toBeNull();
    const subs = (await prisma.subcategory.findMany({ where: { categoryId: target.id } })).map((s) => s.name).sort();
    expect(subs).toEqual(["Kids", "Parties", "bridal"]); // Bridal joined the existing "bridal"
    const moved = await prisma.business.findFirstOrThrow({ where: { categoryId: target.id, subcategoryId: { not: null } }, include: { subcategory: true } });
    expect(moved.subcategory?.name).toBe("Parties");
    expect(await prisma.auditLog.count({ where: { action: "MERGE_CATEGORY" } })).toBe(1);
  });

  it("merges an ordinary category and refuses a pending target", async () => {
    const a = await prisma.category.create({ data: { name: "Old Name", slug: "old-name" } });
    const b = await prisma.category.create({ data: { name: "Waiting", slug: "waiting", status: "PENDING" } });
    const target = await prisma.category.findUniqueOrThrow({ where: { slug: "henna-and-mehndi" } });
    expect((await call("POST", `/admin/categories/${a.id}/merge`, { targetId: b.id })).status).toBe(409);
    expect((await call("POST", `/admin/categories/${a.id}/merge`, { targetId: target.id, subcategoryId: "nope" })).status).toBe(400);
    expect((await call("POST", `/admin/categories/${a.id}/merge`, { targetId: target.id })).status).toBe(200);
    expect(await prisma.category.findUnique({ where: { id: a.id } })).toBeNull();
    await prisma.category.delete({ where: { id: b.id } });
  });

  it("rejects a category, rejects its pending listings with the reason, and blocks the same text next time", async () => {
    await submit({ customCategory: "Spam Stuff" });
    const c = (await category("Spam Stuff"))!;
    const r = await call("POST", `/admin/categories/${c.id}/reject`, { reason: "Not a service category." });
    expect(r.status).toBe(200);
    expect(r.body.rejectedListings).toBe(1);
    expect((await prisma.category.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("REJECTED");
    const listing = await prisma.business.findFirstOrThrow({ where: { categoryId: c.id } });
    expect(listing).toMatchObject({ status: "REJECTED", rejectionReason: "Not a service category." });
    expect((await call("POST", `/admin/categories/${c.id}/reject`, {})).status).toBe(409);
    const again = await submit({ customCategory: "spam stuff" });
    expect(again.status).toBe(400);
    expect(again.body.fieldErrors.customCategory).toBeTruthy();
    expect((await call("GET", "/categories", undefined, "")).body.categories.some((x: { slug: string }) => x.slug === "spam-stuff")).toBe(false);
  });
});
