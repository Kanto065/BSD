import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { startTestDb, type TestDb } from "./helpers/testdb.js";
import { MemoryStorage } from "../src/common/storage.js";
import sharp from "sharp";
import { hashPassword } from "../src/common/passwords.js";

// A member's saved business details, their own listings, owner edits, and the admin link to an owner.

vi.setConfig({ testTimeout: 60_000, hookTimeout: 240_000 });
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-hs256-signing";

let t: TestDb;
let prisma: PrismaClient;
let app: FastifyInstance;
let storage: MemoryStorage;
let adminToken = "";
let modToken = "";

const PASSWORD = "Correct-Horse-Battery-77";
const SECRET_EMAIL = "owner-secret@example.com";
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
const LONG_DESCRIPTION = `We bake and sell fresh bread and cakes every morning. ${words(30)}`;

async function call(method: string, url: string, opts: { body?: unknown; cookie?: string; token?: string } = {}) {
  const res = await app.inject({
    method: method as "GET",
    url,
    headers: { ...(opts.cookie ? { cookie: opts.cookie } : {}), ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
    ...(opts.body !== undefined ? { payload: opts.body as object } : {}),
  });
  const raw = res.headers["set-cookie"];
  const setCookie = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null, cookie: setCookie ? setCookie.split(";")[0] : undefined };
}

let n = 0;
async function register(): Promise<{ id: string; email: string; cookie: string }> {
  const email = `owner${++n}@test.example`;
  const r = await call("POST", "/auth/register", {
    body: { name: "Owner Person", email, password: PASSWORD, postcode: "SA1 4PE", accountType: "GENERAL" },
  });
  return { id: r.body.user.id, email, cookie: r.cookie! };
}

async function listingFor(ownerUserId: string | null, over: Record<string, unknown> = {}) {
  const zone = await prisma.coverageZone.findUniqueOrThrow({ where: { slug: "zone-1" } });
  const category = await prisma.category.findFirstOrThrow({ where: { status: "APPROVED", requiresOwnerName: false } });
  const slug = `owned-bakery-${++n}`;
  return prisma.business.create({
    data: {
      slug,
      name: "Owned Bakery",
      categoryId: category.id,
      description: LONG_DESCRIPTION,
      servicesOffered: ["Bread"],
      phone: "01792 123 456",
      email: SECRET_EMAIL,
      showEmail: true,
      postcode: "SA1 4PE",
      postcodeDistrict: "SA1",
      zoneId: zone.id,
      otherAreaText: "Around Swansea",
      status: "APPROVED",
      ownerUserId,
      ...over,
    },
  });
}

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
  storage = new MemoryStorage();
  app = buildApp({ storage });
  await app.ready();
  const login = async (email: string) =>
    (JSON.parse((await app.inject({ method: "POST", url: "/admin/login", payload: { email, password: PASSWORD } })).body) as { accessToken: string }).accessToken;
  adminToken = await login("admin@test.example");
  modToken = await login("mod@test.example");
});

afterAll(async () => {
  await app?.close();
  await prisma?.$disconnect();
  await t?.stop();
});

describe("saved business details", () => {
  it("needs a session on every route", async () => {
    expect((await call("GET", "/auth/business-profile")).status).toBe(401);
    expect((await call("PUT", "/auth/business-profile", { body: { data: {}, step: 0 } })).status).toBe(401);
    expect((await call("DELETE", "/auth/business-profile")).status).toBe(401);
  });

  it("starts empty, round trips, sanitises, normalises the postcode and clears", async () => {
    const m = await register();
    expect((await call("GET", "/auth/business-profile", { cookie: m.cookie })).body).toEqual({ data: {}, step: 0 });

    const data = { name: "<b>Rina</b> Bakes", postcode: "sa1  4pe", servicesOffered: ["Bread", "<i>Cakes</i>"], showEmail: false, phone: "not checked yet" };
    const saved = await call("PUT", "/auth/business-profile", { cookie: m.cookie, body: { data, step: 2 } });
    expect(saved.status).toBe(200);
    const got = (await call("GET", "/auth/business-profile", { cookie: m.cookie })).body;
    expect(got.step).toBe(2);
    expect(got.data).toEqual({ name: "Rina Bakes", postcode: "SA1 4PE", servicesOffered: ["Bread", "Cakes"], showEmail: false, phone: "not checked yet" });

    // a postcode that does not parse is kept as typed, and a second save replaces the first
    await call("PUT", "/auth/business-profile", { cookie: m.cookie, body: { data: { postcode: "SA1" }, step: 0 } });
    expect((await call("GET", "/auth/business-profile", { cookie: m.cookie })).body.data).toEqual({ postcode: "SA1" });

    expect((await call("DELETE", "/auth/business-profile", { cookie: m.cookie })).status).toBe(200);
    expect((await call("GET", "/auth/business-profile", { cookie: m.cookie })).body).toEqual({ data: {}, step: 0 });
  });

  it("rejects unknown keys, over long text, too many items and a bad step", async () => {
    const m = await register();
    const put = (body: unknown) => call("PUT", "/auth/business-profile", { cookie: m.cookie, body });
    expect((await put({ data: { isAdmin: true }, step: 0 })).status).toBe(400);
    expect((await put({ data: { consentAccurateInfo: true }, step: 0 })).status).toBe(400); // consents are never stored
    expect((await put({ data: { name: "x".repeat(121) }, step: 0 })).status).toBe(400);
    expect((await put({ data: { servicesOffered: Array(16).fill("a") }, step: 0 })).status).toBe(400);
    expect((await put({ data: {}, step: 9 })).status).toBe(400);
    expect((await put({ data: {} })).status).toBe(400);
    expect((await call("GET", "/auth/business-profile", { cookie: m.cookie })).body).toEqual({ data: {}, step: 0 });
  });

  it("never returns another member's details", async () => {
    const a = await register();
    const b = await register();
    await call("PUT", "/auth/business-profile", { cookie: a.cookie, body: { data: { name: "Only A" }, step: 1 } });
    expect((await call("GET", "/auth/business-profile", { cookie: b.cookie })).body).toEqual({ data: {}, step: 0 });
    await call("DELETE", "/auth/business-profile", { cookie: b.cookie });
    expect((await call("GET", "/auth/business-profile", { cookie: a.cookie })).body.data).toEqual({ name: "Only A" });
  });
});

describe("my listings", () => {
  it("lists only the caller's listings, with the category name even while it is pending", async () => {
    const a = await register();
    const b = await register();
    const pendingCat = await prisma.category.create({ data: { name: "Waiting Category", slug: "waiting-category", status: "PENDING", submittedByUserId: a.id } });
    const mine = await listingFor(a.id, { status: "PENDING", categoryId: pendingCat.id });
    await listingFor(b.id);
    await listingFor(null);
    const r = await call("GET", "/auth/listings", { cookie: a.cookie });
    expect(r.status).toBe(200);
    expect(r.body.items).toHaveLength(1);
    expect(r.body.items[0]).toMatchObject({ id: mine.id, status: "PENDING", category: { name: "Waiting Category" }, showEmail: true });
    expect((await call("GET", "/auth/listings")).status).toBe(401);
  });

  it("answers 404 for a listing that belongs to someone else, on read and on edit", async () => {
    const a = await register();
    const b = await register();
    const theirs = await listingFor(b.id);
    const anonymous = await listingFor(null);
    for (const id of [theirs.id, anonymous.id, "does-not-exist"]) {
      expect((await call("GET", `/auth/listings/${id}`, { cookie: a.cookie })).status).toBe(404);
      expect((await call("PATCH", `/auth/listings/${id}`, { cookie: a.cookie, body: { phone: "01792 000 000" } })).status).toBe(404);
    }
    expect((await prisma.business.findUniqueOrThrow({ where: { id: theirs.id } })).phone).toBe("01792 123 456");
    const own = await call("GET", `/auth/listings/${theirs.id}`, { cookie: b.cookie });
    expect(own.status).toBe(200);
    expect(own.body.listing).toMatchObject({ name: "Owned Bakery", email: SECRET_EMAIL, showEmail: true });
  });
});

describe("owner edits", () => {
  it("changes contact fields and the email switch, sets ownerEditedAt and applies at once", async () => {
    const m = await register();
    const l = await listingFor(m.id);
    const r = await call("PATCH", `/auth/listings/${l.id}`, { cookie: m.cookie, body: { phone: "01792 999 888", showEmail: false, openingHours: "<b>Mon to Fri</b> 9 to 5" } });
    expect(r.status).toBe(200);
    expect(r.body.listing).toMatchObject({ phone: "01792 999 888", showEmail: false, openingHours: "Mon to Fri 9 to 5" });
    const row = await prisma.business.findUniqueOrThrow({ where: { id: l.id } });
    expect(row.ownerEditedAt).toBeInstanceOf(Date);
    expect(row.status).toBe("APPROVED");
    expect(row.email).toBe(SECRET_EMAIL); // the address is kept for the BSD team
  });

  it("refuses name, category, postcode, status and other fields the owner may not change", async () => {
    const m = await register();
    const l = await listingFor(m.id);
    for (const body of [{ name: "New Name" }, { postcode: "SA2 0AA" }, { status: "APPROVED" }, { category: "x" }, { verificationStatus: "COMMUNITY_VERIFIED" }, { ownerUserId: "x" }]) {
      expect((await call("PATCH", `/auth/listings/${l.id}`, { cookie: m.cookie, body })).status, JSON.stringify(body)).toBe(400);
    }
    const row = await prisma.business.findUniqueOrThrow({ where: { id: l.id } });
    expect(row.name).toBe("Owned Bakery");
    expect(row.ownerEditedAt).toBeNull();
  });

  it("refuses showEmail with no email, and enforces the 150 character description rule", async () => {
    const m = await register();
    const l = await listingFor(m.id, { email: null, showEmail: false });
    const no = await call("PATCH", `/auth/listings/${l.id}`, { cookie: m.cookie, body: { showEmail: true } });
    expect(no.status).toBe(400);
    expect(no.body.fieldErrors.showEmail).toBeTruthy();
    const withEmail = await call("PATCH", `/auth/listings/${l.id}`, { cookie: m.cookie, body: { email: "new@example.com", showEmail: true } });
    expect(withEmail.status).toBe(200);
    const short = await call("PATCH", `/auth/listings/${l.id}`, { cookie: m.cookie, body: { description: "Too short." } });
    expect(short.status).toBe(400);
    expect(short.body.fieldErrors.description).toMatch(/at least 150 characters/);
    expect((await call("PATCH", `/auth/listings/${l.id}`, { cookie: m.cookie, body: { description: LONG_DESCRIPTION + " More." } })).status).toBe(200);
  });

  it("keeps at least one area served and the owner name when the category needs it", async () => {
    const m = await register();
    const l = await listingFor(m.id, { otherAreaText: null });
    // no served zones, localities or free text exist on this row, so clearing nothing is fine but removing the last one is not
    const set = await call("PATCH", `/auth/listings/${l.id}`, { cookie: m.cookie, body: { serveZones: ["zone-2"], localities: ["skewen"] } });
    expect(set.status).toBe(200);
    expect(set.body.listing.serveZones).toEqual(["zone-2"]);
    const clear = await call("PATCH", `/auth/listings/${l.id}`, { cookie: m.cookie, body: { serveZones: [], localities: [] } });
    expect(clear.status).toBe(400);
    expect((await call("PATCH", `/auth/listings/${l.id}`, { cookie: m.cookie, body: { serveZones: ["zone-9"] } })).status).toBe(400);

    const personal = await prisma.category.findFirstOrThrow({ where: { requiresOwnerName: true, status: "APPROVED" } });
    const p = await listingFor(m.id, { categoryId: personal.id, ownerName: "Rina" });
    const blank = await call("PATCH", `/auth/listings/${p.id}`, { cookie: m.cookie, body: { ownerName: "" } });
    expect(blank.status).toBe(400);
    expect(blank.body.fieldErrors.ownerName).toBeTruthy();
  });

  it("allows PENDING and APPROVED listings only", async () => {
    const m = await register();
    for (const status of ["REJECTED", "REMOVED"] as const) {
      const l = await listingFor(m.id, { status });
      expect((await call("PATCH", `/auth/listings/${l.id}`, { cookie: m.cookie, body: { phone: "01792 000 111" } })).status).toBe(409);
    }
    const pending = await listingFor(m.id, { status: "PENDING" });
    expect((await call("PATCH", `/auth/listings/${pending.id}`, { cookie: m.cookie, body: { phone: "01792 000 111" } })).status).toBe(200);
  });

  it("never leaks the address once the owner hides it (public detail, search and category list)", async () => {
    const m = await register();
    const l = await listingFor(m.id, { name: "Leak Check Bakery" });
    const category = await prisma.category.findUniqueOrThrow({ where: { id: l.categoryId } });
    const urls = [`/businesses/${l.slug}`, `/businesses/search?q=Leak+Check`, `/businesses/search?category=${category.slug}&pageSize=50`];
    const shown = await call("GET", urls[0]!);
    expect(shown.body.email).toBe(SECRET_EMAIL);

    await call("PATCH", `/auth/listings/${l.id}`, { cookie: m.cookie, body: { showEmail: false } });
    for (const url of urls) {
      const r = await call("GET", url);
      expect(r.status, url).toBe(200);
      expect(JSON.stringify(r.body), url).not.toContain(SECRET_EMAIL);
    }
    expect((await call("GET", urls[0]!)).body.email).toBeNull();
    await call("PATCH", `/auth/listings/${l.id}`, { cookie: m.cookie, body: { showEmail: true } });
    expect((await call("GET", urls[0]!)).body.email).toBe(SECRET_EMAIL);
  });
});

describe("admin links an owner", () => {
  it("needs ADMIN, links by exact email, answers 404 for an unknown email, clears, and writes the audit trail", async () => {
    const m = await register();
    const l = await listingFor(null);

    expect((await call("PUT", `/admin/listings/${l.id}/owner`, { body: { email: m.email } })).status).toBe(401);
    expect((await call("PUT", `/admin/listings/${l.id}/owner`, { token: modToken, body: { email: m.email } })).status).toBe(403);

    expect((await call("PUT", `/admin/listings/${l.id}/owner`, { token: adminToken, body: { email: "nobody@test.example" } })).status).toBe(404);
    expect((await call("PUT", `/admin/listings/${l.id}/owner`, { token: adminToken, body: { email: "not-an-email" } })).status).toBe(400);
    expect((await prisma.business.findUniqueOrThrow({ where: { id: l.id } })).ownerUserId).toBeNull();

    const linked = await call("PUT", `/admin/listings/${l.id}/owner`, { token: adminToken, body: { email: m.email.toUpperCase() } });
    expect(linked.status).toBe(200);
    expect(linked.body.owner).toMatchObject({ id: m.id, email: m.email });
    expect((await call("GET", "/auth/listings", { cookie: m.cookie })).body.items.map((i: { id: string }) => i.id)).toEqual([l.id]);

    const detail = await call("GET", `/admin/listings/${l.id}`, { token: modToken });
    expect(detail.body.listing.owner).toMatchObject({ id: m.id, name: "Owner Person", email: m.email });

    expect((await call("PUT", `/admin/listings/${l.id}/owner`, { token: adminToken, body: { email: null } })).body.owner).toBeNull();
    expect((await call("GET", "/auth/listings", { cookie: m.cookie })).body.items).toEqual([]);

    const audit = await prisma.auditLog.findMany({ where: { entityId: l.id, action: "listing.owner_set" }, orderBy: { createdAt: "asc" } });
    expect(audit).toHaveLength(2);
    expect(audit[0]!.details).toEqual({ from: null, to: m.id });
    expect(audit[1]!.details).toEqual({ from: m.id, to: null });
  });

  it("shows when the owner last edited the listing", async () => {
    const m = await register();
    const l = await listingFor(m.id);
    await call("PATCH", `/auth/listings/${l.id}`, { cookie: m.cookie, body: { phone: "01792 777 666" } });
    const detail = await call("GET", `/admin/listings/${l.id}`, { token: modToken });
    expect(detail.body.listing.ownerEditedAt).toBeTruthy();
  });
});

describe("owner photos", () => {
  const jpeg = (w = 400, h = 300) => {
    const noise = Buffer.alloc(w * h * 3);
    for (let i = 0; i < noise.length; i++) noise[i] = (i * 7919) % 251;
    return sharp(noise, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
  };
  async function upload(id: string, cookie: string, data: Buffer, filename = "shop.jpg") {
    const boundary = "----bsdtest" + Math.random().toString(16).slice(2);
    const payload = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${filename}"\r\nContent-Type: image/jpeg\r\n\r\n`),
      data,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const res = await app.inject({ method: "POST", url: `/auth/listings/${id}/photos`, payload, headers: { "content-type": `multipart/form-data; boundary=${boundary}`, ...(cookie ? { cookie } : {}) } });
    return { status: res.statusCode, body: JSON.parse(res.body) as { photos?: { id: string; url: string; isLogo: boolean }[]; error?: string; fieldErrors?: Record<string, string> } };
  }
  const keyOf = (u: string) => u.replace(/^\/uploads\//, "");
  type P = { id: string; isLogo: boolean };

  it("adds, sets the logo, removes, stores publicly and sets ownerEditedAt", async () => {
    const m = await register();
    const l = await listingFor(m.id);
    const a = await upload(l.id, m.cookie, await jpeg());
    expect(a.status).toBe(201);
    expect(a.body.photos).toHaveLength(1);
    expect(storage.objects.has(keyOf(a.body.photos![0]!.url))).toBe(true);
    expect(storage.privateObjects.size).toBe(0);
    expect((await prisma.business.findUniqueOrThrow({ where: { id: l.id } })).ownerEditedAt).toBeTruthy();

    const b = await upload(l.id, m.cookie, await jpeg(500, 350));
    const [p1, p2] = b.body.photos!;
    const logo1 = await call("PUT", `/auth/listings/${l.id}/logo/${p1!.id}`, { cookie: m.cookie });
    expect(logo1.body.photos.filter((p: P) => p.isLogo).map((p: P) => p.id)).toEqual([p1!.id]);
    const logo2 = await call("PUT", `/auth/listings/${l.id}/logo/${p2!.id}`, { cookie: m.cookie });
    expect(logo2.body.photos.filter((p: P) => p.isLogo).map((p: P) => p.id)).toEqual([p2!.id]);
    expect((await call("GET", `/businesses/${l.slug}`)).body.logoUrl).toBe(p2!.url);

    const del = await call("DELETE", `/auth/listings/${l.id}/photos/${p1!.id}`, { cookie: m.cookie });
    expect(del.body.photos).toHaveLength(1);
    expect(storage.objects.has(keyOf(p1!.url))).toBe(false);
    expect((await call("GET", `/auth/listings/${l.id}`, { cookie: m.cookie })).body.listing.photos).toHaveLength(1);
  });

  it("caps at a logo plus four photos, rejects bad files, and 404s for other owners and closed listings", async () => {
    const m = await register();
    const other = await register();
    const l = await listingFor(m.id);
    const img = await jpeg();
    for (let i = 0; i < 5; i++) expect((await upload(l.id, m.cookie, img)).status).toBe(201);
    const over = await upload(l.id, m.cookie, img);
    expect(over.status).toBe(400);
    expect(over.body.fieldErrors?.photos).toMatch(/up to 4 photos/);

    const fresh = await listingFor(m.id);
    const bad = await upload(fresh.id, m.cookie, Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"), "x.svg");
    expect(bad.status).toBe(400);
    expect(bad.body.fieldErrors?.photos).toBeTruthy();

    const photoId = (await prisma.businessPhoto.findFirstOrThrow({ where: { businessId: l.id } })).id;
    expect((await upload(l.id, other.cookie, img)).status).toBe(404);
    expect((await call("DELETE", `/auth/listings/${l.id}/photos/${photoId}`, { cookie: other.cookie })).status).toBe(404);
    expect((await call("PUT", `/auth/listings/${l.id}/logo/${photoId}`, { cookie: other.cookie })).status).toBe(404);
    // a photo id from another listing is a 404 too
    expect((await call("DELETE", `/auth/listings/${fresh.id}/photos/${photoId}`, { cookie: m.cookie })).status).toBe(404);
    expect((await upload(l.id, "", img)).status).toBe(401);

    const removed = await listingFor(m.id, { status: "REMOVED" });
    expect((await upload(removed.id, m.cookie, img)).status).toBe(404);
  });

  it("returns photos, tags and the existing counts, and records no statistics", async () => {
    const m = await register();
    const l = await listingFor(m.id);
    await upload(l.id, m.cookie, await jpeg());
    const list = (await call("GET", "/auth/listings", { cookie: m.cookie })).body.items[0];
    expect(list._count).toEqual({ photos: 1, updateRequests: 0, claimRequests: 0 });
    const detail = (await call("GET", `/auth/listings/${l.id}`, { cookie: m.cookie })).body.listing;
    expect(Array.isArray(detail.category.serviceTags)).toBe(true);
    expect((await call("POST", `/businesses/${l.slug}/event`, { body: { type: "view" } })).status).toBe(404); // no beacon route exists
  });
});
