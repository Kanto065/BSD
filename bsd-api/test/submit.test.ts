import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import sharp from "sharp";
import { startTestDb, type TestDb } from "./helpers/testdb.js";
import { MemoryStorage } from "../src/common/storage.js";

// POST /businesses/submit end to end: real seed, real Prisma engine, real migrations, real image processing, with
// an in-memory image store in place of MinIO.

vi.setConfig({ testTimeout: 60_000, hookTimeout: 240_000 });
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-hs256-signing";

const CONFIRMATION = "Thank you! Your listing has been submitted for review. BSD Team will verify and publish it within 3–7 days.";

let t: TestDb;
let prisma: PrismaClient;
let storage: MemoryStorage;
let app: FastifyInstance;
let buildApp: (opts?: { storage?: MemoryStorage | null }) => FastifyInstance;

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
const DESCRIPTION = `We cook fresh Bangladeshi food & sweets for families. ${words(50)}`;

type Field = [string, string];
type FileField = { field: string; filename: string; contentType: string; data: Buffer };

function multipart(fields: Field[], files: FileField[] = []) {
  const boundary = "----bsdtest" + Math.random().toString(16).slice(2);
  const chunks: Buffer[] = [];
  for (const [name, value] of fields) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  for (const f of files) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${f.field}"; filename="${f.filename}"\r\nContent-Type: ${f.contentType}\r\n\r\n`));
    chunks.push(f.data, Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(chunks), headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}

const CONSENTS = [
  "consentAccurateInfo",
  "consentPublishPermission",
  "consentNoLiability",
  "consentDataStorage",
  "gdprConsentStorage",
  "gdprConsentRights",
];

function validFields(overrides: Record<string, string | string[] | null> = {}): Field[] {
  const base: Record<string, string | string[]> = {
    name: "Nasima's Kitchen & Sweets",
    category: "home-based-food-services",
    subcategory: "home-based-food-and-tiffin-services-home-chefs",
    description: DESCRIPTION,
    servicesOffered: ["Tiffin", "Party catering"],
    phone: "01639 123 456",
    whatsapp: "07700 900123",
    email: "hello@example.com",
    postcode: "sa10 9aa",
    serveZones: ["zone-2"],
    localities: ["neath-town-centre", "skewen"],
    ...Object.fromEntries(CONSENTS.map((c) => [c, "true"])),
  };
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null) delete base[k];
    else base[k] = v;
  }
  return Object.entries(base).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x] as Field) : [[k, v] as Field]));
}

let memberCount = 0;
/** A signed-in member created straight in the database. Returns its session cookie. */
async function memberCookie(): Promise<string> {
  const { signToken } = await import("../src/common/tokens.js");
  const user = await prisma.user.create({
    data: { name: "Test Member", email: `member${++memberCount}@test.example`, passwordHash: "x", postcode: "SA1 4PE", postcodeDistrict: "SA1" },
  });
  return `bsd_session=${signToken("session", user.id, user.tokenVersion)}`;
}

// Every call is a new member unless a cookie is given (an empty cookie means signed out), so the daily cap of one
// member never gets in the way of the other tests.
async function submit(fields: Field[], files: FileField[] = [], headers: Record<string, string> = {}, target = app) {
  const body = multipart(fields, files);
  const cookie = headers.cookie ?? (await memberCookie());
  const res = await target.inject({ method: "POST", url: "/businesses/submit", payload: body.payload, headers: { ...body.headers, ...headers, cookie } });
  return { status: res.statusCode, json: () => JSON.parse(res.body) };
}

async function photoJpeg(w: number, h: number) {
  const noise = Buffer.alloc(w * h * 3);
  for (let i = 0; i < noise.length; i++) noise[i] = (i * 7919) % 251;
  return sharp(noise, { raw: { width: w, height: h, channels: 3 } })
    .jpeg({ quality: 90 })
    .withExif({ IFD0: { Copyright: "private-camera-owner" } })
    .toBuffer();
}

const latestBusiness = () =>
  prisma.business.findFirst({
    orderBy: { submittedAt: "desc" },
    include: { photos: true, servedZones: { include: { zone: true } }, localities: { include: { locality: true } }, zone: true, category: true },
  });

beforeAll(async () => {
  t = await startTestDb();
  process.env.DATABASE_URL = t.url;
  const { PrismaClient: Client } = await import("@prisma/client");
  prisma = new Client({ datasources: { db: { url: t.url } } });
  delete process.env.SEED_ADMIN_EMAIL;
  delete process.env.SEED_ADMIN_PASSWORD;
  const { runSeed } = await import("../prisma/seed.js");
  await runSeed(prisma);
  ({ buildApp } = (await import("../src/server.js")) as never);
  storage = new MemoryStorage();
  app = buildApp({ storage });
  await app.ready();
});

afterAll(async () => {
  await app?.close();
  await prisma?.$disconnect();
  await t?.stop();
});

describe("a valid submission", () => {
  it("is saved as PENDING and NEWLY_LISTED with the exact confirmation message, and is not public", async () => {
    const logo = await photoJpeg(400, 400);
    const photo = await photoJpeg(1600, 1200);
    const r = await submit(validFields(), [
      { field: "logo", filename: "logo.jpg", contentType: "image/jpeg", data: logo },
      { field: "photos", filename: "shop.jpg", contentType: "image/jpeg", data: photo },
    ]);
    expect(r.status).toBe(201);
    expect(r.json()).toEqual({ ok: true, message: CONFIRMATION });

    const b = (await latestBusiness())!;
    expect(b.status).toBe("PENDING");
    expect(b.verificationStatus).toBe("NEWLY_LISTED");
    expect(b.name).toBe("Nasima's Kitchen & Sweets");
    expect(b.description.startsWith("We cook fresh Bangladeshi food & sweets")).toBe(true);
    expect(b.postcode).toBe("SA10 9AA");
    expect(b.postcodeDistrict).toBe("SA10");
    expect(b.zone.slug).toBe("zone-2"); // derived from the postcode, not chosen
    expect(b.category.slug).toBe("home-based-food-services");
    expect(b.servicesOffered).toEqual(["Tiffin", "Party catering"]);
    expect(b.address).toBe("HomeBased");
    expect(b.whatsapp).toBe("07700 900123");
    expect(b.servedZones.map((z) => z.zone.slug)).toEqual(["zone-2"]);
    expect(b.localities.map((l) => l.locality.slug).sort()).toEqual(["neath-town-centre", "skewen"]);
    for (const c of CONSENTS) expect((b as Record<string, unknown>)[c]).toBe(true);
    expect(b.slug).toMatch(/^nasima-s-kitchen-and-sweets-sa10/);

    // not visible anywhere public until an admin approves it
    expect((await app.inject(`/businesses/${b.slug}`)).statusCode).toBe(404);
    expect(JSON.parse((await app.inject("/businesses/search?q=nasima")).body).total).toBe(0);
  });

  it("stores the images compressed, without metadata, with a thumbnail for the large one", async () => {
    const b = (await latestBusiness())!;
    expect(b.photos).toHaveLength(2);
    const logo = b.photos.find((p) => p.isLogo)!;
    const photo = b.photos.find((p) => !p.isLogo)!;
    expect(logo.url).toMatch(/^\/uploads\/businesses\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/);
    expect(logo.thumbUrl).toBeNull(); // 400px: already small
    expect(photo.thumbUrl).toMatch(/-thumb\.webp$/);
    expect(photo.width).toBe(1600);
    expect(photo.height).toBe(1200);

    const stored = storage.objects.get(photo.url.replace("/uploads/", ""))!;
    expect(stored.contentType).toBe("image/jpeg");
    expect(stored.body.includes(Buffer.from("private-camera-owner"))).toBe(false);
    expect(stored.body.length).toBe(photo.sizeBytes);
    const thumb = storage.objects.get(photo.thumbUrl!.replace("/uploads/", ""))!;
    expect(thumb.contentType).toBe("image/webp");
    expect(Math.max((await sharp(thumb.body).metadata()).width!, (await sharp(thumb.body).metadata()).height!)).toBe(720);
  });

  it("works without any images, and gives each listing its own slug", async () => {
    const before = await prisma.business.count();
    expect((await submit(validFields())).status).toBe(201);
    expect((await submit(validFields())).status).toBe(201);
    expect(await prisma.business.count()).toBe(before + 2);
    const slugs = (await prisma.business.findMany({ select: { slug: true } })).map((b) => b.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("email visibility", () => {
  const stored = async (fields: Field[]) => {
    expect((await submit(fields)).status).toBe(201);
    return (await latestBusiness())!;
  };

  it("keeps the email but hides it when the form sends no flag", async () => {
    const b = await stored(validFields());
    expect(b.email).toBe("hello@example.com");
    expect(b.showEmail).toBe(false);
  });

  it("shows it only when the flag is the string true", async () => {
    expect((await stored(validFields({ showEmail: "true" }))).showEmail).toBe(true);
    expect((await stored(validFields({ showEmail: "false" }))).showEmail).toBe(false);
    expect((await stored(validFields({ showEmail: "yes" }))).showEmail).toBe(false);
  });

  it("forces the flag off when there is no email", async () => {
    const b = await stored(validFields({ email: null, showEmail: "true" }));
    expect(b.email).toBeNull();
    expect(b.showEmail).toBe(false);
  });
});

describe("hide full address", () => {
  const stored = async (fields: Field[]) => {
    expect((await submit(fields)).status).toBe(201);
    return (await latestBusiness())!;
  };

  it("is off by default, on only for the string true, and the street is still stored", async () => {
    expect((await stored(validFields({ address: "1 High Street" }))).hideFullAddress).toBe(false);
    const on = await stored(validFields({ address: "1 High Street", hideFullAddress: "true" }));
    expect(on.hideFullAddress).toBe(true);
    expect(on.address).toBe("1 High Street");
    expect((await stored(validFields({ hideFullAddress: "false" }))).hideFullAddress).toBe(false);
    expect((await stored(validFields({ hideFullAddress: "yes" }))).hideFullAddress).toBe(false);
  });

  it("can be ticked with no street, which keeps the HomeBased fallback", async () => {
    const b = await stored(validFields({ hideFullAddress: "true" }));
    expect(b.hideFullAddress).toBe(true);
    expect(b.address).toBe("HomeBased");
  });
});

describe("the rules from the submission form", () => {
  const expectError = async (fields: Field[], field: string, files: FileField[] = [], status = 400) => {
    const before = await prisma.business.count();
    const r = await submit(fields, files);
    expect(r.status, JSON.stringify(r.json())).toBe(status);
    expect(r.json().ok).toBe(false);
    expect(Object.keys(r.json().fieldErrors)).toContain(field);
    expect(await prisma.business.count()).toBe(before); // nothing saved
    return r.json().fieldErrors[field] as string;
  };

  it("requires all six consent boxes", async () => {
    for (const c of CONSENTS) {
      expect(await expectError(validFields({ [c]: null }), c)).toBe("Please tick this box to continue.");
      await expectError(validFields({ [c]: "false" }), c);
    }
  });

  it("requires a description of at least 150 characters and at most 150 words", async () => {
    const short = "The short description must be at least 150 characters.";
    expect(await expectError(validFields({ description: "a".repeat(149) }), "description")).toBe(short);
    expect(await expectError(validFields({ description: `   ${"a".repeat(149)}   ` }), "description")).toBe(short);
    // tags are stripped by sanitising and do not count toward the 150
    expect(await expectError(validFields({ description: `<b>${"a".repeat(100)}</b><i></i><script></script>${"b".repeat(49)}` }), "description")).toBe(short);
    expect(await expectError(validFields({ description: words(151) }), "description")).toBe("The short description must be 150 words or fewer.");
    expect((await submit(validFields({ description: "a".repeat(150) }))).status).toBe(201);
    expect((await submit(validFields({ description: `  ${"a".repeat(150)}  ` }))).status).toBe(201);
    // 150 characters made of short repeated words is under the word limit
    expect((await submit(validFields({ description: "ab ".repeat(51).trim() }))).status).toBe(201);
    expect((await submit(validFields({ description: words(150) }))).status).toBe(201);
  });

  it("requires the name, a real category and at least one service", async () => {
    await expectError(validFields({ name: null }), "name");
    await expectError(validFields({ category: "no-such-category" }), "category");
    await expectError(validFields({ servicesOffered: ["", "  "] }), "servicesOffered");
  });

  it("only accepts a subcategory of the chosen category", async () => {
    await expectError(validFields({ subcategory: "automotive-garages-and-transport-car-wash-and-valeting" }), "subcategory");
  });

  it("requires the owner name for Independent Professionals (from the category row)", async () => {
    const fields = validFields({ category: "independent-professionals", subcategory: "independent-professionals-office-less-hub-individual-freelancers-translators-and-interpreters" });
    await expectError(fields, "ownerName");
    expect((await submit([...fields, ["ownerName", "Rupa Begum"]])).status).toBe(201);
  });

  it("requires a full postcode inside SA1 to SA20 or SA31 to SA34", async () => {
    await expectError(validFields({ postcode: null }), "postcode");
    await expectError(validFields({ postcode: "SA1" }), "postcode");
    await expectError(validFields({ postcode: "SA25 1AA" }), "postcode");
    await expectError(validFields({ postcode: "CF10 1AA" }), "postcode");
    expect((await submit(validFields({ postcode: "sa31 1aa" }))).status).toBe(201);
    expect((await latestBusiness())!.zone.slug).toBe("zone-3");
  });

  it("requires at least one area served, and only known areas", async () => {
    await expectError(validFields({ serveZones: [], localities: [] }), "serveZones");
    await expectError(validFields({ serveZones: ["zone-9"] }), "serveZones");
    await expectError(validFields({ localities: ["atlantis"] }), "localities");
    // free text alone is enough, like "Others (Specify)" on the paper form
    expect((await submit([...validFields({ serveZones: [], localities: [] }), ["otherAreaText", "Tenby and Pembroke"]])).status).toBe(201);
  });

  it("checks phone numbers and email addresses", async () => {
    await expectError(validFields({ phone: "call me" }), "phone");
    await expectError(validFields({ phone: "123" }), "phone");
    await expectError(validFields({ whatsapp: "abc" }), "whatsapp");
    await expectError(validFields({ email: "not-an-email" }), "email");
  });

  it("rejects files that are not really images, whatever their name and declared type", async () => {
    const fake = Buffer.from("<?php system($_GET['c']); ?>");
    const msg = await expectError(validFields(), "photos", [{ field: "photos", filename: "shop.jpg", contentType: "image/jpeg", data: fake }]);
    expect(msg).toContain("Only JPEG, PNG and WebP");
    await expectError(validFields(), "logo", [
      { field: "logo", filename: "logo.svg", contentType: "image/svg+xml", data: Buffer.from("<svg onload='alert(1)'/>") },
    ]);
  });

  it("limits image size and count", async () => {
    const big = Buffer.alloc(11 * 1024 * 1024, 1);
    await expectError(validFields(), "photos", [{ field: "photos", filename: "big.jpg", contentType: "image/jpeg", data: big }], 413);
    const small = await photoJpeg(100, 100);
    const five = Array.from({ length: 5 }, (_, i) => ({ field: "photos", filename: `p${i}.jpg`, contentType: "image/jpeg", data: small }));
    await expectError(validFields(), "photos", five);
    const twoLogos = [0, 1].map((i) => ({ field: "logo", filename: `l${i}.jpg`, contentType: "image/jpeg", data: small }));
    await expectError(validFields(), "logo", twoLogos);
  });

  it("stores text as clean plain text", async () => {
    const r = await submit(
      validFields({
        name: "<script>alert(1)</script>Halal <b>Mart</b>",
        description: `<img src=x onerror=alert(1)>Fish & chips, "fresh" daily. ${words(50)}`,
        servicesOffered: ["<i>Delivery</i>", "<b></b>"],
        otherAreaText: "<a href='javascript:x'>Tenby</a>",
      })
    );
    expect(r.status).toBe(201);
    const b = (await latestBusiness())!;
    expect(b.name).toBe("Halal Mart");
    expect(b.description.startsWith('Fish & chips, "fresh" daily.')).toBe(true);
    expect(b.servicesOffered).toEqual(["Delivery"]);
    expect(b.otherAreaText).toBe("Tenby");
    expect(b.slug).toMatch(/^halal-mart-sa10/);
  });
});

describe("sign in is required", () => {
  it("refuses a request without a session cookie with 401 and stores nothing", async () => {
    const before = { businesses: await prisma.business.count(), objects: storage.objects.size };
    const photo = await photoJpeg(300, 300);
    for (const cookie of ["", "bsd_session=junk"]) {
      const r = await submit(validFields(), [{ field: "photos", filename: "a.jpg", contentType: "image/jpeg", data: photo }], { cookie });
      expect(r.status).toBe(401);
      expect(r.json()).toEqual({ error: "Please sign in to submit a listing." });
    }
    expect(await prisma.business.count()).toBe(before.businesses);
    expect(storage.objects.size).toBe(before.objects);
  });

  it("links the new listing to the member who submitted it", async () => {
    const cookie = await memberCookie();
    expect((await submit(validFields({ name: "Owned Kitchen" }), [], { cookie })).status).toBe(201);
    const b = (await latestBusiness())!;
    const user = await prisma.user.findUniqueOrThrow({ where: { email: `member${memberCount}@test.example` } });
    expect(b.ownerUserId).toBe(user.id);
  });

  it("allows 5 listings per member in 24 hours and then answers 429, other members are not affected", async () => {
    const cookie = await memberCookie();
    const codes: number[] = [];
    // a different address each time, so only the per-member cap is under test
    for (let i = 0; i < 6; i++) codes.push((await submit(validFields(), [], { cookie, "x-forwarded-for": `192.0.2.${100 + i}` })).status);
    expect(codes).toEqual([201, 201, 201, 201, 201, 429]);
    expect((await submit(validFields(), [], { "x-forwarded-for": "192.0.2.200" })).status).toBe(201);
    // a listing older than a day no longer counts
    await prisma.business.updateMany({ where: { owner: { email: `member${memberCount - 1}@test.example` } }, data: { submittedAt: new Date(Date.now() - 25 * 3600_000) } });
    expect((await submit(validFields(), [], { cookie, "x-forwarded-for": "192.0.2.201" })).status).toBe(201);
  });
});

describe("protection", () => {
  it("rejects a request that is not a multipart form", async () => {
    const r = await app.inject({ method: "POST", url: "/businesses/submit", payload: { name: "x" }, headers: { cookie: await memberCookie() } });
    expect(r.statusCode, r.body).toBe(415);
  });

  it("accepts but silently drops a submission that fills the hidden honeypot field", async () => {
    const before = await prisma.business.count();
    const r = await submit([...validFields(), ["companyWebsite", "http://spam.example"]]);
    expect(r.status).toBe(201);
    expect(r.json().message).toBe(CONFIRMATION);
    expect(await prisma.business.count()).toBe(before);
  });

  it("removes stored images again if saving the listing fails", async () => {
    // A temporary trigger makes the database reject this one listing, after the images were already stored.
    await t.db.exec(`
      CREATE FUNCTION reject_test_listing() RETURNS trigger AS $$
      BEGIN
        IF NEW.name LIKE 'FAIL-DB%' THEN RAISE EXCEPTION 'simulated database failure'; END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql;
      CREATE TRIGGER reject_test_listing BEFORE INSERT ON "Business" FOR EACH ROW EXECUTE FUNCTION reject_test_listing();`);
    try {
      const objectsBefore = storage.objects.size;
      const before = await prisma.business.count();
      const r = await submit(validFields({ name: "FAIL-DB Test Shop" }), [
        { field: "logo", filename: "logo.jpg", contentType: "image/jpeg", data: await photoJpeg(300, 300) },
        { field: "photos", filename: "shop.jpg", contentType: "image/jpeg", data: await photoJpeg(1200, 900) },
      ]);
      expect(r.status).toBe(500);
      expect(await prisma.business.count()).toBe(before);
      expect(storage.objects.size).toBe(objectsBefore); // the logo, the photo and its thumbnail were all removed
    } finally {
      await t.db.exec(`DROP TRIGGER reject_test_listing ON "Business"; DROP FUNCTION reject_test_listing();`);
    }
  });

  it("refuses images when no storage is configured, but still takes text-only submissions", async () => {
    const noStorage = buildApp({ storage: null });
    await noStorage.ready();
    try {
      const photo = await photoJpeg(300, 300);
      const r = await submit(validFields(), [{ field: "photos", filename: "a.jpg", contentType: "image/jpeg", data: photo }], {}, noStorage);
      expect(r.status).toBe(503);
      expect((await submit(validFields(), [], {}, noStorage)).status).toBe(201);
    } finally {
      await noStorage.close();
    }
  });

  it("stores nothing, and leaves no stray images, when storing an image fails", async () => {
    const broken = new MemoryStorage();
    broken.failPuts = true;
    const other = buildApp({ storage: broken });
    await other.ready();
    try {
      const before = await prisma.business.count();
      const r = await submit(validFields(), [{ field: "photos", filename: "a.jpg", contentType: "image/jpeg", data: await photoJpeg(300, 300) }], {}, other);
      expect(r.status).toBe(500);
      expect(await prisma.business.count()).toBe(before);
      expect(broken.objects.size).toBe(0);
    } finally {
      await other.close();
    }
  });

  it("limits each visitor to 5 submissions an hour, counted per real client address", async () => {
    const limited = buildApp({ storage: new MemoryStorage() });
    await limited.ready();
    try {
      const visitor = { "x-forwarded-for": "203.0.113.7" };
      const codes: number[] = [];
      for (let i = 0; i < 6; i++) codes.push((await submit(validFields(), [], visitor, limited)).status);
      expect(codes).toEqual([201, 201, 201, 201, 201, 429]);
      // a different visitor is not affected
      expect((await submit(validFields(), [], { "x-forwarded-for": "198.51.100.9" }, limited)).status).toBe(201);
    } finally {
      await limited.close();
    }
  });
});
