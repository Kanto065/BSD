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
let storage: MemoryStorage;
let buildApp: (opts?: { storage?: MemoryStorage | null }) => FastifyInstance;
let modToken: string;
let volToken: string;

const PASSWORD = "Correct-Horse-Battery-77";
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

async function call(method: string, url: string, opts: { token?: string; body?: unknown; ip?: string; target?: FastifyInstance } = {}) {
  const res = await (opts.target ?? app).inject({
    method: method as "GET",
    url,
    headers: { ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), ...(opts.ip ? { "x-forwarded-for": opts.ip } : {}) },
    ...(opts.body !== undefined ? { payload: opts.body as object } : {}),
  });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null };
}

async function listing(status: "APPROVED" | "PENDING" | "REJECTED" = "APPROVED") {
  const category = await prisma.category.findUniqueOrThrow({ where: { slug: "groceries-and-halal" } });
  const zone = await prisma.coverageZone.findUniqueOrThrow({ where: { slug: "zone-1" } });
  const n = Math.random().toString(36).slice(2, 8);
  return prisma.business.create({
    data: {
      slug: `shop-${n}`,
      name: `Shop ${n}`,
      categoryId: category.id,
      description: words(60),
      servicesOffered: ["Groceries"],
      phone: "01792 000000",
      postcode: "SA1 1AA",
      postcodeDistrict: "SA1",
      zoneId: zone.id,
      status,
    },
  });
}

const person = { name: "Rahim Uddin", email: "rahim@example.com", phone: "07700 900111" };

beforeAll(async () => {
  t = await startTestDb();
  process.env.DATABASE_URL = t.url;
  const { PrismaClient: Client } = await import("@prisma/client");
  prisma = new Client({ datasources: { db: { url: t.url } } });
  delete process.env.SEED_ADMIN_EMAIL;
  const { runSeed } = await import("../prisma/seed.js");
  await runSeed(prisma);
  const hash = await hashPassword(PASSWORD);
  await prisma.adminUser.create({ data: { name: "Mod", email: "mod@test.example", role: "MODERATOR", passwordHash: hash } });
  await prisma.adminUser.create({ data: { name: "Vol", email: "vol@test.example", role: "VOLUNTEER", passwordHash: hash } });
  ({ buildApp } = (await import("../src/server.js")) as never);
  storage = new MemoryStorage();
  app = buildApp({ storage });
  await app.ready();
  modToken = (await call("POST", "/admin/login", { body: { email: "mod@test.example", password: PASSWORD } })).body.accessToken;
  volToken = (await call("POST", "/admin/login", { body: { email: "vol@test.example", password: PASSWORD } })).body.accessToken;
});

afterAll(async () => {
  await app?.close();
  await prisma?.$disconnect();
  await t?.stop();
});

describe("requests from a listing page", () => {
  it("records a claim, an update request and a removal request, with the FAQ's time frames", async () => {
    const b = await listing();
    const claim = await call("POST", `/businesses/${b.slug}/claim`, { body: { ...person, proof: "I can reply from the email on the listing and send a utility bill." } });
    expect(claim.status).toBe(201);
    expect(claim.body.message).toMatch(/3–7 working days/);
    const update = await call("POST", `/businesses/${b.slug}/request-update`, { body: { ...person, message: "Our <b>opening hours</b> changed to 9-6." } });
    expect(update.body.message).toBe("Thank you. Updates are usually processed within 3–7 working days.");
    const removal = await call("POST", `/businesses/${b.slug}/request-removal`, { body: { ...person, reason: "Closed" } });
    expect(removal.body.message).toMatch(/3–7 working days/);
    const emergency = await call("POST", `/businesses/${b.slug}/request-removal`, { body: { ...person, reason: "Wrong phone number", isEmergency: true } });
    expect(emergency.body.message).toBe("Thank you. Emergency removals are handled within 24 hours.");

    const stored = await prisma.listingUpdateRequest.findFirstOrThrow({ where: { businessId: b.id } });
    expect(stored.requestedChanges).toEqual({ message: "Our opening hours changed to 9-6." });
    expect(stored.requesterEmail).toBe("rahim@example.com");
    expect(await prisma.listingClaimRequest.count({ where: { businessId: b.id } })).toBe(1);
    expect(await prisma.listingRemovalRequest.count({ where: { businessId: b.id } })).toBe(2);
  });

  it("checks the fields", async () => {
    const b = await listing();
    const bad = await call("POST", `/businesses/${b.slug}/claim`, { body: { name: "x", email: "no", proof: "short" } });
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.body.fieldErrors).sort()).toEqual(["email", "name", "proof"]);
    expect((await call("POST", `/businesses/${b.slug}/request-update`, { body: { ...person, message: "" } })).body.fieldErrors.message).toBeDefined();
    expect((await call("POST", `/businesses/${b.slug}/request-update`, { body: { ...person, phone: "call me", message: "Please change the hours." } })).body.fieldErrors.phone).toBeDefined();
  });

  it("only works for public listings, and looks the same as a missing one otherwise", async () => {
    for (const status of ["PENDING", "REJECTED"] as const) {
      const hidden = await listing(status);
      const r = await call("POST", `/businesses/${hidden.slug}/request-update`, { body: { ...person, message: "Please change the hours." } });
      expect(r.status).toBe(404);
      expect(r.body).toEqual((await call("POST", "/businesses/no-such-shop/request-update", { body: { ...person, message: "Please change the hours." } })).body);
    }
  });

  it("quietly drops requests that fill the hidden honeypot field", async () => {
    const b = await listing();
    const r = await call("POST", `/businesses/${b.slug}/request-removal`, { body: { ...person, companyWebsite: "http://spam.example" } });
    expect(r.status).toBe(201);
    expect(await prisma.listingRemovalRequest.count({ where: { businessId: b.id } })).toBe(0);
  });

  it("allows 5 requests an hour per visitor", async () => {
    const limited = buildApp({ storage: new MemoryStorage() });
    await limited.ready();
    try {
      const b = await listing();
      const codes: number[] = [];
      for (let i = 0; i < 6; i++) {
        codes.push((await call("POST", `/businesses/${b.slug}/request-update`, { target: limited, ip: "203.0.113.9", body: { ...person, message: "Please change the hours." } })).status);
      }
      expect(codes).toEqual([201, 201, 201, 201, 201, 429]);
    } finally {
      await limited.close();
    }
  });
});

describe("admin request queues", () => {
  it("lists emergency removals first, then oldest first; moderators only", async () => {
    const b = await listing();
    await prisma.listingRemovalRequest.create({ data: { businessId: b.id, requesterName: "Old", requestedAt: new Date("2026-01-01") } });
    await prisma.listingRemovalRequest.create({ data: { businessId: b.id, requesterName: "Urgent", isEmergency: true, requestedAt: new Date("2026-06-01") } });
    const r = await call("GET", "/admin/removal-requests?pageSize=100", { token: modToken });
    expect(r.status).toBe(200);
    const items = r.body.items as { isEmergency: boolean; requestedAt: string }[];
    const firstNormal = items.findIndex((i) => !i.isEmergency);
    expect(items.slice(firstNormal).every((i) => !i.isEmergency)).toBe(true);
    expect(items[0].isEmergency).toBe(true);
    expect((await call("GET", "/admin/removal-requests", { token: volToken })).status).toBe(403);
    expect((await call("GET", "/admin/update-requests", { token: volToken })).status).toBe(403);
    expect((await call("GET", "/admin/update-requests")).status).toBe(401);
  });

  it("accepting a removal request removes the listing, with an audit record; a request is handled once", async () => {
    const b = await listing();
    await call("POST", `/businesses/${b.slug}/request-removal`, { body: { ...person, reason: "Closed down" } });
    const req = await prisma.listingRemovalRequest.findFirstOrThrow({ where: { businessId: b.id } });
    const r = await call("PATCH", `/admin/removal-requests/${req.id}`, { token: modToken, body: { status: "REMOVED", note: "Confirmed by phone" } });
    expect(r.status).toBe(200);
    expect((await prisma.business.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("REMOVED");
    expect((await call("GET", `/businesses/${b.slug}`)).status).toBe(404);
    const done = await prisma.listingRemovalRequest.findUniqueOrThrow({ where: { id: req.id } });
    expect(done.reviewNote).toBe("Confirmed by phone");
    expect(done.reviewedById).toBeTruthy();
    expect(await prisma.auditLog.count({ where: { entityId: b.id, action: "REMOVE_LISTING" } })).toBe(1);
    expect((await call("PATCH", `/admin/removal-requests/${req.id}`, { token: modToken, body: { status: "REJECTED" } })).status).toBe(409);
  });

  it("rejecting a removal request keeps the listing; update requests are marked applied or rejected", async () => {
    const b = await listing();
    await call("POST", `/businesses/${b.slug}/request-removal`, { body: { ...person, reason: "Not mine" } });
    await call("POST", `/businesses/${b.slug}/request-update`, { body: { ...person, message: "New phone 01792 111111" } });
    const removal = await prisma.listingRemovalRequest.findFirstOrThrow({ where: { businessId: b.id } });
    const update = await prisma.listingUpdateRequest.findFirstOrThrow({ where: { businessId: b.id } });
    expect((await call("PATCH", `/admin/removal-requests/${removal.id}`, { token: modToken, body: { status: "REJECTED" } })).status).toBe(200);
    expect((await prisma.business.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("APPROVED");
    expect((await call("PATCH", `/admin/update-requests/${update.id}`, { token: modToken, body: { status: "WHATEVER" } })).status).toBe(400);
    expect((await call("PATCH", `/admin/update-requests/${update.id}`, { token: modToken, body: { status: "APPLIED" } })).status).toBe(200);
    expect((await prisma.listingUpdateRequest.findUniqueOrThrow({ where: { id: update.id } })).status).toBe("APPLIED");
  });

  it("shows pending counts on the dashboard", async () => {
    const d = (await call("GET", "/admin/dashboard", { token: modToken })).body;
    expect(d.pendingUpdates).toBe(await prisma.listingUpdateRequest.count({ where: { status: "PENDING" } }));
    expect(d.pendingRemovals).toBe(await prisma.listingRemovalRequest.count({ where: { status: "PENDING" } }));
    expect(d.emergencyRemovals).toBe(await prisma.listingRemovalRequest.count({ where: { status: "PENDING", isEmergency: true } }));
    expect(d.emergencyRemovals).toBeGreaterThan(0);
  });
});

describe("readiness and sitemap", () => {
  it("reports the database and storage, and 503 when storage is down, without details", async () => {
    const ok = await call("GET", "/health/ready");
    expect(ok).toEqual({ status: 200, body: { status: "ok", database: "ok", storage: "ok" } });
    storage.failPuts = true;
    try {
      const bad = await call("GET", "/health/ready");
      expect(bad).toEqual({ status: 503, body: { status: "degraded", database: "ok", storage: "failing" } });
    } finally {
      storage.failPuts = false;
    }
  });

  it("lists only public listings for the sitemap", async () => {
    const pub = await listing("APPROVED");
    const hidden = await listing("PENDING");
    const slugs = (await call("GET", "/businesses/sitemap")).body.items.map((i: { slug: string }) => i.slug);
    expect(slugs).toContain(pub.slug);
    expect(slugs).not.toContain(hidden.slug);
    const approvedCount = await prisma.business.count({ where: { status: "APPROVED" } });
    expect(slugs).toHaveLength(approvedCount);
  });
});
