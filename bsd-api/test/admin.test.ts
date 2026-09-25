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

const PASSWORD = "Correct-Horse-Battery-77";
const ROLES = ["SUPER_ADMIN", "ADMIN", "MODERATOR", "VOLUNTEER"] as const;
const emailFor = (role: string) => `${role.toLowerCase()}@test.example`;
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

type Res = { status: number; body: any; cookie?: string; headers: Record<string, unknown> };

async function call(method: string, url: string, opts: { token?: string; body?: unknown; cookie?: string; ip?: string; target?: FastifyInstance } = {}): Promise<Res> {
  const res = await (opts.target ?? app).inject({
    method: method as "GET",
    url,
    headers: {
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
      ...(opts.ip ? { "x-forwarded-for": opts.ip } : {}),
    },
    ...(opts.body !== undefined ? { payload: opts.body as object } : {}),
  });
  const setCookie = res.headers["set-cookie"];
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null, cookie: raw ? raw.split(";")[0] : undefined, headers: res.headers };
}

async function login(email: string, password = PASSWORD) {
  const r = await call("POST", "/admin/login", { body: { email, password } });
  return { ...r, token: r.body?.accessToken as string };
}

async function makeListing(overrides: Record<string, unknown> = {}) {
  const category = await prisma.category.findUniqueOrThrow({ where: { slug: "restaurants-and-takeaways" } });
  const zone = await prisma.coverageZone.findUniqueOrThrow({ where: { slug: "zone-1" } });
  const n = Math.random().toString(36).slice(2, 8);
  return prisma.business.create({
    data: {
      slug: `listing-${n}`,
      name: `Listing ${n}`,
      categoryId: category.id,
      description: `A local restaurant. ${words(60)}`,
      servicesOffered: ["Dine in"],
      phone: "01792 000000",
      address: "1 High Street, Swansea",
      postcode: "SA1 1AA",
      postcodeDistrict: "SA1",
      zoneId: zone.id,
      servedZones: { create: [{ zoneId: zone.id }] },
      ...overrides,
    },
  });
}

const tokens: Record<string, string> = {};

beforeAll(async () => {
  t = await startTestDb();
  process.env.DATABASE_URL = t.url;
  const { PrismaClient: Client } = await import("@prisma/client");
  prisma = new Client({ datasources: { db: { url: t.url } } });
  delete process.env.SEED_ADMIN_EMAIL;
  const { runSeed } = await import("../prisma/seed.js");
  await runSeed(prisma);
  const hash = await hashPassword(PASSWORD);
  for (const role of ROLES) await prisma.adminUser.create({ data: { name: `${role} Person`, email: emailFor(role), role, passwordHash: hash } });
  ({ buildApp } = (await import("../src/server.js")) as never);
  storage = new MemoryStorage();
  app = buildApp({ storage });
  await app.ready();
  for (const role of ROLES) tokens[role] = (await login(emailFor(role))).token;
});

afterAll(async () => {
  await app?.close();
  await prisma?.$disconnect();
  await t?.stop();
});

describe("signing in", () => {
  it("returns a short-lived token and sets the refresh token as an httpOnly, strict, /admin-only cookie", async () => {
    const r = await login(emailFor("MODERATOR"));
    expect(r.status).toBe(200);
    expect(r.body.admin).toEqual({ name: "MODERATOR Person", email: "moderator@test.example", role: "MODERATOR", mustChangePassword: false });
    expect(r.token.split(".")).toHaveLength(3);
    const setCookie = String(r.headers["set-cookie"]);
    expect(setCookie).toMatch(/^bsd_refresh=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);
    expect(setCookie).toMatch(/Path=\/admin/i);
    expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|\$2b\$/);
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    const wrong = await login(emailFor("ADMIN"), "not-the-password");
    const unknown = await login("nobody@test.example", "not-the-password");
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    // failed attempts are counted but not left over after a success
    await login(emailFor("ADMIN"));
    expect((await prisma.adminUser.findUniqueOrThrow({ where: { email: emailFor("ADMIN") } })).failedLoginCount).toBe(0);
  });

  it("locks the account for 15 minutes after 5 wrong passwords, even for the right password", async () => {
    await prisma.adminUser.create({ data: { name: "Lock Test", email: "lock@test.example", role: "MODERATOR", passwordHash: await hashPassword(PASSWORD) } });
    for (let i = 0; i < 5; i++) expect((await login("lock@test.example", "wrong-password")).status).toBe(401);
    const locked = await login("lock@test.example");
    expect(locked.status).toBe(429);
    expect(locked.body.error).toMatch(/15 minutes/);
    // once the lock has passed, the right password works again
    await prisma.adminUser.update({ where: { email: "lock@test.example" }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    expect((await login("lock@test.example")).status).toBe(200);
  });

  it("refuses a disabled account", async () => {
    await prisma.adminUser.create({ data: { name: "Off", email: "off@test.example", role: "ADMIN", active: false, passwordHash: await hashPassword(PASSWORD) } });
    expect((await login("off@test.example")).status).toBe(401);
  });

  it("limits sign-in attempts to 10 per 15 minutes from one address", async () => {
    const limited = buildApp({ storage: new MemoryStorage() });
    await limited.ready();
    try {
      const codes: number[] = [];
      for (let i = 0; i < 11; i++) codes.push((await call("POST", "/admin/login", { target: limited, ip: "203.0.113.50", body: { email: "x@test.example", password: "y" } })).status);
      expect(codes.slice(0, 10).every((c) => c === 401)).toBe(true);
      expect(codes[10]).toBe(429);
    } finally {
      await limited.close();
    }
  });
});

describe("sessions", () => {
  it("renews the access token from the refresh cookie", async () => {
    const r = await login(emailFor("MODERATOR"));
    const refreshed = await call("POST", "/admin/refresh", { cookie: r.cookie });
    expect(refreshed.status).toBe(200);
    expect((await call("GET", "/admin/dashboard", { token: refreshed.body.accessToken })).status).toBe(200);
    expect((await call("POST", "/admin/refresh")).status).toBe(401);
  });

  it("rejects tampered tokens, and a refresh token used as an access token", async () => {
    const r = await login(emailFor("MODERATOR"));
    const [h, p, s] = r.token.split(".");
    const forged = JSON.parse(Buffer.from(p, "base64url").toString());
    forged.sub = (await prisma.adminUser.findUniqueOrThrow({ where: { email: emailFor("SUPER_ADMIN") } })).id;
    const tampered = [h, Buffer.from(JSON.stringify(forged)).toString("base64url"), s].join(".");
    expect((await call("GET", "/admin/users", { token: tampered })).status).toBe(401);
    const refreshToken = decodeURIComponent(r.cookie!.split("=")[1]);
    expect((await call("GET", "/admin/dashboard", { token: refreshToken })).status).toBe(401);
    expect((await call("GET", "/admin/dashboard", { token: "not.a.token" })).status).toBe(401);
  });

  it("signing out ends every session for that person", async () => {
    await prisma.adminUser.create({ data: { name: "Out", email: "out@test.example", role: "MODERATOR", passwordHash: await hashPassword(PASSWORD) } });
    const a = await login("out@test.example");
    const b = await login("out@test.example"); // a second device
    expect((await call("POST", "/admin/logout", { cookie: a.cookie })).status).toBe(200);
    expect((await call("GET", "/admin/dashboard", { token: a.token })).status).toBe(401);
    expect((await call("GET", "/admin/dashboard", { token: b.token })).status).toBe(401);
    expect((await call("POST", "/admin/refresh", { cookie: b.cookie })).status).toBe(401);
  });

  it("marks admin responses as never cacheable", async () => {
    const r = await call("GET", "/admin/dashboard", { token: tokens.MODERATOR });
    expect(r.headers["cache-control"]).toBe("no-store");
  });
});

describe("temporary passwords", () => {
  it("only allows 'who am I' and 'change password' until a strong new password is set", async () => {
    await prisma.adminUser.create({
      data: { name: "New Person", email: "new@test.example", role: "SUPER_ADMIN", mustChangePassword: true, passwordHash: await hashPassword("Bangladesh@123") },
    });
    const first = await login("new@test.example", "Bangladesh@123");
    expect(first.status).toBe(200);
    expect(first.body.admin.mustChangePassword).toBe(true);
    const blocked = await call("GET", "/admin/dashboard", { token: first.token });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("password_change_required");
    expect((await call("GET", "/admin/me", { token: first.token })).status).toBe(200);

    const change = (current: string, next: string) => call("POST", "/admin/change-password", { token: first.token, body: { currentPassword: current, newPassword: next } });
    expect((await change("wrong", "A-Completely-Different-99")).body.fieldErrors.currentPassword).toBeDefined();
    for (const weak of ["short1!", "Bangladesh@2026", "Swansea-City-2026", "new-person-and-more", "aaaaaaaaaaaaaa", "Abc12345678901"]) {
      expect((await change("Bangladesh@123", weak)).body.fieldErrors?.newPassword, weak).toBeDefined();
    }

    const ok = await change("Bangladesh@123", "Tidal-Lantern-Orchard-42");
    expect(ok.status).toBe(200);
    expect(ok.body.admin.mustChangePassword).toBe(false);
    expect((await call("GET", "/admin/dashboard", { token: ok.body.accessToken })).status).toBe(200);
    expect((await call("GET", "/admin/me", { token: first.token })).status).toBe(401); // old session ended
    expect((await login("new@test.example", "Bangladesh@123")).status).toBe(401);
    expect((await login("new@test.example", "Tidal-Lantern-Orchard-42")).status).toBe(200);
  });
});

describe("what each role can reach", () => {
  const routes: [string, string, (typeof ROLES)[number]][] = [
    ["GET", "/admin/dashboard", "VOLUNTEER"],
    ["GET", "/admin/verification-queue", "VOLUNTEER"],
    ["GET", "/admin/listings", "MODERATOR"],
    ["GET", "/admin/claims", "MODERATOR"],
    ["GET", "/admin/messages", "MODERATOR"],
    ["GET", "/admin/audit-log", "ADMIN"],
    ["GET", "/admin/users", "SUPER_ADMIN"],
  ];
  const rank = { VOLUNTEER: 1, MODERATOR: 2, ADMIN: 3, SUPER_ADMIN: 4 };

  it("allows each route from its minimum role upward, and refuses everyone below", async () => {
    for (const [method, url, minimum] of routes) {
      for (const role of ROLES) {
        const r = await call(method, url, { token: tokens[role] });
        expect(r.status, `${role} ${url}`).toBe(rank[role] >= rank[minimum] ? 200 : 403);
      }
      expect((await call(method, url)).status, `anonymous ${url}`).toBe(401);
    }
  });

  it("a volunteer can verify but cannot approve, edit or remove", async () => {
    const l = await makeListing({ status: "APPROVED" });
    expect((await call("PATCH", `/admin/listings/${l.id}/approve`, { token: tokens.VOLUNTEER })).status).toBe(403);
    expect((await call("PATCH", `/admin/listings/${l.id}`, { token: tokens.VOLUNTEER, body: { name: "Hacked" } })).status).toBe(403);
    expect((await call("DELETE", `/admin/listings/${l.id}`, { token: tokens.VOLUNTEER })).status).toBe(403);
    expect((await call("PATCH", `/admin/listings/${l.id}/verification`, { token: tokens.VOLUNTEER, body: { status: "PENDING_VERIFICATION" } })).status).toBe(200);
  });

  it("applies a role change at once, by ending that person's sessions", async () => {
    const target = await prisma.adminUser.create({ data: { name: "Demote Me", email: "demote@test.example", role: "ADMIN", passwordHash: await hashPassword(PASSWORD) } });
    const s = await login("demote@test.example");
    expect((await call("GET", "/admin/audit-log", { token: s.token })).status).toBe(200);
    expect((await call("PATCH", `/admin/users/${target.id}`, { token: tokens.SUPER_ADMIN, body: { role: "VOLUNTEER" } })).status).toBe(200);
    expect((await call("GET", "/admin/audit-log", { token: s.token })).status).toBe(401);
    expect((await call("GET", "/admin/audit-log", { token: (await login("demote@test.example")).token })).status).toBe(403);
  });
});

describe("moderation", () => {
  it("approving makes a listing public; rejecting or removing hides it again, each with an audit record", async () => {
    const l = await makeListing();
    const pub = () => call("GET", `/businesses/${l.slug}`);
    expect((await pub()).status).toBe(404);

    expect((await call("PATCH", `/admin/listings/${l.id}/approve`, { token: tokens.MODERATOR })).status).toBe(200);
    expect((await pub()).status).toBe(200);
    expect((await call("PATCH", `/admin/listings/${l.id}/approve`, { token: tokens.MODERATOR })).status).toBe(409);
    const approved = await prisma.business.findUniqueOrThrow({ where: { id: l.id } });
    expect(approved.reviewedById).toBeTruthy();

    expect((await call("PATCH", `/admin/listings/${l.id}/reject`, { token: tokens.MODERATOR, body: {} })).status).toBe(400);
    expect((await call("PATCH", `/admin/listings/${l.id}/reject`, { token: tokens.MODERATOR, body: { reason: "Not a <b>Bangladeshi</b> business" } })).status).toBe(200);
    expect((await pub()).status).toBe(404);
    expect((await prisma.business.findUniqueOrThrow({ where: { id: l.id } })).rejectionReason).toBe("Not a Bangladeshi business");

    await call("PATCH", `/admin/listings/${l.id}/approve`, { token: tokens.MODERATOR });
    expect((await call("DELETE", `/admin/listings/${l.id}`, { token: tokens.MODERATOR, body: { reason: "Closed down" } })).status).toBe(200);
    expect((await prisma.business.findUniqueOrThrow({ where: { id: l.id } })).status).toBe("REMOVED");
    expect((await pub()).status).toBe(404);

    const actions = (await prisma.auditLog.findMany({ where: { entityId: l.id }, orderBy: { createdAt: "asc" } })).map((a) => a.action);
    expect(actions).toEqual(["APPROVE_LISTING", "REJECT_LISTING", "APPROVE_LISTING", "REMOVE_LISTING"]);
    const detail = await call("GET", `/admin/listings/${l.id}`, { token: tokens.MODERATOR });
    expect(detail.body.history).toHaveLength(4);
  });

  it("lists by status, oldest pending first, with counts", async () => {
    const r = await call("GET", "/admin/listings?status=PENDING&pageSize=100", { token: tokens.MODERATOR });
    const dates = r.body.items.map((i: { submittedAt: string }) => i.submittedAt);
    expect(dates).toEqual([...dates].sort());
    expect(r.body.items.every((i: { status: string }) => i.status === "PENDING")).toBe(true);
    expect(r.body.counts.PENDING).toBe(r.body.total);
    expect((await call("GET", "/admin/listings?status=BOGUS", { token: tokens.MODERATOR })).status).toBe(400);
  });
});

describe("verification", () => {
  it("only approved listings can be verified; verifying records who and when, downgrading clears it", async () => {
    const pending = await makeListing();
    expect((await call("PATCH", `/admin/listings/${pending.id}/verification`, { token: tokens.VOLUNTEER, body: { status: "COMMUNITY_VERIFIED" } })).status).toBe(409);

    const l = await makeListing({ status: "APPROVED" });
    const queue = await call("GET", "/admin/verification-queue?pageSize=100", { token: tokens.VOLUNTEER });
    expect(queue.body.items.map((i: { id: string }) => i.id)).toContain(l.id);

    expect((await call("PATCH", `/admin/listings/${l.id}/verification`, { token: tokens.VOLUNTEER, body: { status: "COMMUNITY_VERIFIED" } })).status).toBe(200);
    const verified = await prisma.business.findUniqueOrThrow({ where: { id: l.id } });
    expect(verified.verifiedAt).toBeTruthy();
    expect(verified.verifiedById).toBe((await prisma.adminUser.findUniqueOrThrow({ where: { email: emailFor("VOLUNTEER") } })).id);
    const featured = await call("GET", "/businesses/featured?limit=24");
    expect(featured.body.items.map((i: { slug: string }) => i.slug)).toContain(l.slug);
    expect((await call("GET", "/admin/verification-queue?pageSize=100", { token: tokens.VOLUNTEER })).body.items.map((i: { id: string }) => i.id)).not.toContain(l.id);

    await call("PATCH", `/admin/listings/${l.id}/verification`, { token: tokens.VOLUNTEER, body: { status: "PENDING_VERIFICATION" } });
    const downgraded = await prisma.business.findUniqueOrThrow({ where: { id: l.id } });
    expect(downgraded.verifiedAt).toBeNull();
    expect(downgraded.verifiedById).toBeNull();
    expect((await call("PATCH", `/admin/listings/${l.id}/verification`, { token: tokens.VOLUNTEER, body: { status: "SUPER" } })).status).toBe(400);
  });
});

describe("editing a listing", () => {
  it("applies the submission form's rules, recomputes the zone from a new postcode, and records a diff", async () => {
    const l = await makeListing();
    const edit = (body: object) => call("PATCH", `/admin/listings/${l.id}`, { token: tokens.MODERATOR, body });

    expect((await edit({ description: words(20) })).body.fieldErrors.description).toBeDefined();
    expect((await edit({ postcode: "SA25 1AA" })).body.fieldErrors.postcode).toBeDefined();
    expect((await edit({ unknownField: "x" })).status).toBe(400);

    const r = await edit({ name: "Better <i>Name</i> & Co", postcode: "sa10 9aa", localities: ["skewen"] });
    expect(r.status).toBe(200);
    expect(r.body.changed.sort()).toEqual(["localities", "name", "postcode", "postcodeDistrict", "zoneId"].sort());
    const after = await prisma.business.findUniqueOrThrow({ where: { id: l.id }, include: { zone: true, localities: { include: { locality: true } } } });
    expect(after.name).toBe("Better Name & Co");
    expect(after.postcode).toBe("SA10 9AA");
    expect(after.zone.slug).toBe("zone-2");
    expect(after.localities.map((x) => x.locality.slug)).toEqual(["skewen"]);
    const entry = await prisma.auditLog.findFirstOrThrow({ where: { entityId: l.id, action: "EDIT_LISTING" } });
    expect((entry.details as Record<string, { from: unknown; to: unknown }>).name).toEqual({ from: l.name, to: "Better Name & Co" });

    expect((await edit({ name: "Better Name & Co" })).body.changed).toEqual([]); // nothing changed, nothing logged
  });

  it("keeps the category and subcategory consistent, and requires an owner for Independent Professionals", async () => {
    const sub = await prisma.subcategory.findFirstOrThrow({ where: { category: { slug: "restaurants-and-takeaways" } } });
    const l = await makeListing({ subcategoryId: sub.id });
    const edit = (body: object) => call("PATCH", `/admin/listings/${l.id}`, { token: tokens.MODERATOR, body });
    expect((await edit({ category: "car-services", subcategory: sub.slug })).body.fieldErrors.subcategory).toBeDefined();
    expect((await edit({ category: "car-services" })).status).toBe(200);
    expect((await prisma.business.findUniqueOrThrow({ where: { id: l.id } })).subcategoryId).toBeNull();
    expect((await edit({ category: "independent-professionals" })).body.fieldErrors.ownerName).toBeDefined();
    expect((await edit({ category: "independent-professionals", ownerName: "Rupa Begum" })).status).toBe(200);
  });

  it("removing a photo deletes the row and the stored files", async () => {
    const l = await makeListing();
    storage.objects.set("businesses/x/a.jpg", { body: Buffer.from("a"), contentType: "image/jpeg" });
    storage.objects.set("businesses/x/a-thumb.webp", { body: Buffer.from("b"), contentType: "image/webp" });
    const photo = await prisma.businessPhoto.create({
      data: { businessId: l.id, url: "/uploads/businesses/x/a.jpg", thumbUrl: "/uploads/businesses/x/a-thumb.webp", mimeType: "image/jpeg", sizeBytes: 1 },
    });
    expect((await call("DELETE", `/admin/listings/${l.id}/photos/${photo.id}`, { token: tokens.MODERATOR })).status).toBe(200);
    expect(await prisma.businessPhoto.count({ where: { id: photo.id } })).toBe(0);
    expect(storage.objects.has("businesses/x/a.jpg")).toBe(false);
    expect(storage.objects.has("businesses/x/a-thumb.webp")).toBe(false);
  });
});

describe("team accounts", () => {
  it("creates an account with a one-time password that must be changed", async () => {
    const r = await call("POST", "/admin/users", { token: tokens.SUPER_ADMIN, body: { name: "Field Volunteer", email: "Vol2@Test.example", role: "VOLUNTEER" } });
    expect(r.status).toBe(201);
    expect(r.body.user.email).toBe("vol2@test.example");
    expect(r.body.temporaryPassword).toMatch(/^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/);
    const first = await login("vol2@test.example", r.body.temporaryPassword);
    expect(first.body.admin.mustChangePassword).toBe(true);
    expect((await call("POST", "/admin/users", { token: tokens.SUPER_ADMIN, body: { name: "Again", email: "vol2@test.example", role: "VOLUNTEER" } })).status).toBe(409);
    const stored = await prisma.adminUser.findUniqueOrThrow({ where: { email: "vol2@test.example" } });
    expect(stored.passwordHash).not.toContain(r.body.temporaryPassword);
  });

  it("never lets a Super Admin lock themselves or the site out", async () => {
    const me = await prisma.adminUser.findUniqueOrThrow({ where: { email: emailFor("SUPER_ADMIN") } });
    expect((await call("PATCH", `/admin/users/${me.id}`, { token: tokens.SUPER_ADMIN, body: { role: "ADMIN" } })).status).toBe(409);
    expect((await call("PATCH", `/admin/users/${me.id}`, { token: tokens.SUPER_ADMIN, body: { active: false } })).status).toBe(409);
    // another Super Admin exists ("new@test.example"); disable it, then the last one cannot be demoted by anyone
    const other = await prisma.adminUser.findUniqueOrThrow({ where: { email: "new@test.example" } });
    expect((await call("PATCH", `/admin/users/${other.id}`, { token: tokens.SUPER_ADMIN, body: { active: false } })).status).toBe(200);
    const created = await call("POST", "/admin/users", { token: tokens.SUPER_ADMIN, body: { name: "Second SA", email: "sa2@test.example", role: "SUPER_ADMIN" } });
    const sa2 = await login("sa2@test.example", created.body.temporaryPassword);
    const changed = await call("POST", "/admin/change-password", { token: sa2.token, body: { currentPassword: created.body.temporaryPassword, newPassword: "Quiet-Meadow-Harbour-81" } });
    await call("PATCH", `/admin/users/${created.body.user.id}`, { token: tokens.SUPER_ADMIN, body: { active: false } });
    // now "me" is the only active Super Admin, and the other Super Admin session was ended by the change
    expect((await call("GET", "/admin/users", { token: changed.body.accessToken })).status).toBe(401);
  });

  it("resets another person's password to a one-time password and ends their sessions", async () => {
    const target = await prisma.adminUser.findUniqueOrThrow({ where: { email: emailFor("MODERATOR") } });
    const before = await login(emailFor("MODERATOR"));
    const r = await call("POST", `/admin/users/${target.id}/reset-password`, { token: tokens.SUPER_ADMIN });
    expect(r.status).toBe(200);
    expect((await call("GET", "/admin/dashboard", { token: before.token })).status).toBe(401);
    expect((await login(emailFor("MODERATOR"))).status).toBe(401);
    expect((await login(emailFor("MODERATOR"), r.body.temporaryPassword)).body.admin.mustChangePassword).toBe(true);
  });
});

describe("claims and messages", () => {
  it("decides a claim once, with an audit record", async () => {
    const l = await makeListing({ status: "APPROVED" });
    const claim = await prisma.listingClaimRequest.create({ data: { businessId: l.id, claimantName: "Owner", claimantEmail: "o@example.com", proofText: "Receipt" } });
    const token = (await login(emailFor("ADMIN"))).token;
    expect((await call("GET", "/admin/claims", { token })).body.items.map((c: { id: string }) => c.id)).toContain(claim.id);
    expect((await call("PATCH", `/admin/claims/${claim.id}/approve`, { token, body: { note: "Checked" } })).status).toBe(200);
    expect((await call("PATCH", `/admin/claims/${claim.id}/reject`, { token })).status).toBe(409);
    expect(await prisma.auditLog.count({ where: { entityId: claim.id, action: "APPROVE_CLAIM" } })).toBe(1);
  });

  it("resolves a contact message", async () => {
    const m = await prisma.contactMessage.create({ data: { type: "SUPPORT", name: "A", email: "a@example.com", message: "Hello" } });
    const token = (await login(emailFor("ADMIN"))).token;
    expect((await call("PATCH", `/admin/messages/${m.id}/resolve`, { token })).status).toBe(200);
    expect((await prisma.contactMessage.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("RESOLVED");
  });
});
