import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { startTestDb, type TestDb } from "./helpers/testdb.js";
import { MemoryStorage } from "../src/common/storage.js";
import { hashPassword } from "../src/common/passwords.js";
import { signToken, SESSION_COOKIE } from "../src/common/tokens.js";
import { purgeExpiredProofs } from "../src/common/proof-purge.js";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 240_000 });
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-hs256-signing";

let t: TestDb;
let prisma: PrismaClient;
let app: FastifyInstance;
let storage: MemoryStorage;
const tokens: Record<string, string> = {};

const PASSWORD = "Correct-Horse-Battery-77";
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(64, 2)]);
const TEXT = "I run this shop. I can send the council tax bill and the Companies House letter.";
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
let n = 0;

function multipart(file: { name: string; type: string; body: Buffer } | null, fields: Record<string, string> = {}) {
  const boundary = "----bsdtest" + Math.random().toString(16).slice(2);
  const chunks: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  if (file) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="proof"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`));
    chunks.push(file.body, Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(chunks), headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}

async function member(label: string, phone: string | null = null) {
  n++;
  const u = await prisma.user.create({
    data: { name: `Member ${label}`, email: `${label}${n}@test.example`, passwordHash: "x", postcode: "SA1 4PE", postcodeDistrict: "SA1", phone, badges: { create: { badge: "MEMBER" } } },
  });
  return { id: u.id, email: u.email, cookie: `${SESSION_COOKIE}=${signToken("session", u.id, u.tokenVersion)}` };
}

async function listing(extra: { ownerUserId?: string; status?: "APPROVED" | "PENDING" } = {}) {
  const category = await prisma.category.findUniqueOrThrow({ where: { slug: "groceries-and-halal" } });
  const zone = await prisma.coverageZone.findUniqueOrThrow({ where: { slug: "zone-1" } });
  const s = Math.random().toString(36).slice(2, 8);
  return prisma.business.create({
    data: {
      slug: `shop-${s}`, name: `Shop ${s}`, categoryId: category.id, description: words(60), servicesOffered: ["Groceries"], phone: "01792 000000",
      postcode: "SA1 1AA", postcodeDistrict: "SA1", zoneId: zone.id, status: extra.status ?? "APPROVED", ...(extra.ownerUserId ? { ownerUserId: extra.ownerUserId } : {}),
    },
  });
}

async function claim(slug: string, cookie: string | undefined, file: { name: string; type: string; body: Buffer } | null = null, text = TEXT, ip?: string) {
  const m = multipart(file, { proofText: text });
  const res = await app.inject({
    method: "POST",
    url: `/businesses/${slug}/claim`,
    payload: m.payload,
    headers: { ...m.headers, ...(cookie ? { cookie } : {}), ...(ip ? { "x-forwarded-for": ip } : {}) },
  });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null };
}

async function api(method: "GET" | "PATCH", url: string, opts: { cookie?: string; token?: string; body?: object } = {}) {
  const res = await app.inject({
    method,
    url,
    headers: { ...(opts.cookie ? { cookie: opts.cookie } : {}), ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
    ...(opts.body ? { payload: opts.body } : {}),
  });
  const json = String(res.headers["content-type"]).includes("json");
  return { status: res.statusCode, body: json && res.body ? JSON.parse(res.body) : null, headers: res.headers, raw: res.rawPayload };
}

beforeAll(async () => {
  t = await startTestDb();
  process.env.DATABASE_URL = t.url;
  const { PrismaClient: Client } = await import("@prisma/client");
  prisma = new Client({ datasources: { db: { url: t.url } } });
  delete process.env.SEED_ADMIN_EMAIL;
  await (await import("../prisma/seed.js")).runSeed(prisma);
  const hash = await hashPassword(PASSWORD);
  for (const role of ["ADMIN", "MODERATOR", "VOLUNTEER"] as const) {
    await prisma.adminUser.create({ data: { name: role, email: `${role.toLowerCase()}@test.example`, role, passwordHash: hash } });
  }
  storage = new MemoryStorage();
  const { buildApp } = await import("../src/server.js");
  app = buildApp({ storage });
  await app.ready();
  for (const role of ["ADMIN", "MODERATOR", "VOLUNTEER"]) {
    const r = await app.inject({ method: "POST", url: "/admin/login", payload: { email: `${role.toLowerCase()}@test.example`, password: PASSWORD } });
    tokens[role] = JSON.parse(r.body).accessToken;
  }
});

afterAll(async () => {
  await app?.close();
  await prisma?.$disconnect();
  await t?.stop();
});

describe("POST /businesses/:slug/claim", () => {
  it("needs a signed in member", async () => {
    const b = await listing();
    const r = await claim(b.slug, undefined);
    expect(r.status).toBe(401);
    expect(r.body.error).toBe("Please sign in to claim a listing.");
    const json = await app.inject({ method: "POST", url: `/businesses/${b.slug}/claim`, payload: { proofText: TEXT } });
    expect(json.statusCode).toBe(401);
    expect(await prisma.listingClaimRequest.count({ where: { businessId: b.id } })).toBe(0);
  });

  it("takes the claimant details from the account, with text only, and sends no promise of an email", async () => {
    const m = await member("text", "07700 900123");
    const b = await listing();
    const r = await claim(b.slug, m.cookie);
    expect(r.status).toBe(201);
    expect(r.body.message).not.toMatch(/email/i);
    const row = await prisma.listingClaimRequest.findFirstOrThrow({ where: { businessId: b.id } });
    expect(row).toMatchObject({ userId: m.id, claimantName: "Member text", claimantEmail: m.email, claimantPhone: "07700 900123", status: "PENDING", proofKey: null, purgeAt: null });
  });

  it("stores a document under the private prefix only, with a 7 day purge date", async () => {
    const m = await member("file");
    const b = await listing();
    expect((await claim(b.slug, m.cookie, { name: "bill.pdf", type: "application/pdf", body: PDF })).status).toBe(201);
    const row = await prisma.listingClaimRequest.findFirstOrThrow({ where: { businessId: b.id } });
    expect(row.proofKey).toMatch(new RegExp(`^claims/${m.id}/.+\\.pdf$`));
    expect(row.proofType).toBe("application/pdf");
    expect(storage.privateObjects.has(row.proofKey!)).toBe(true);
    expect(storage.objects.has(row.proofKey!)).toBe(false);
    const days = (row.purgeAt!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  it("checks the bytes, not the file name, and the text and size limits", async () => {
    const m = await member("bad");
    const b = await listing();
    expect((await claim(b.slug, m.cookie, { name: "bill.pdf", type: "application/pdf", body: Buffer.from("MZ not a pdf at all") })).status).toBe(400);
    expect((await claim(b.slug, m.cookie, { name: "x.png", type: "image/png", body: Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]) })).status).toBe(413);
    const short = await claim(b.slug, m.cookie, null, "too short");
    expect(short.status).toBe(400);
    expect(short.body.fieldErrors.proofText).toBeDefined();
    expect((await claim(b.slug, m.cookie, null, "x".repeat(1001))).status).toBe(400);
    expect(await prisma.listingClaimRequest.count({ where: { businessId: b.id } })).toBe(0);
    expect([...storage.privateObjects.keys()].filter((k) => k.startsWith(`claims/${m.id}/`))).toEqual([]);
  });

  it("refuses a second waiting claim, a claim on your own listing, and a hidden listing", async () => {
    const m = await member("dup");
    const b = await listing();
    expect((await claim(b.slug, m.cookie)).status).toBe(201);
    const again = await claim(b.slug, m.cookie, { name: "a.png", type: "image/png", body: PNG });
    expect(again.status).toBe(409);
    expect([...storage.privateObjects.keys()].filter((k) => k.startsWith(`claims/${m.id}/`))).toEqual([]);
    const mine = await listing({ ownerUserId: m.id });
    expect((await claim(mine.slug, m.cookie)).status).toBe(409);
    const hidden = await listing({ status: "PENDING" });
    expect((await claim(hidden.slug, m.cookie)).status).toBe(404);
  });

  it("allows 3 claims a member a day", async () => {
    const m = await member("day");
    const codes: number[] = [];
    for (let i = 0; i < 4; i++) codes.push((await claim((await listing()).slug, m.cookie)).status);
    expect(codes).toEqual([201, 201, 201, 429]);
  });

  it("allows 5 claims an hour per visitor address", async () => {
    const limited = (await import("../src/server.js")).buildApp({ storage: new MemoryStorage() });
    await limited.ready();
    try {
      const m = await member("ip");
      const b = await listing();
      const codes: number[] = [];
      for (let i = 0; i < 6; i++) {
        const mp = multipart(null, { proofText: "short" });
        const res = await limited.inject({ method: "POST", url: `/businesses/${b.slug}/claim`, payload: mp.payload, headers: { ...mp.headers, cookie: m.cookie, "x-forwarded-for": "203.0.113.77" } });
        codes.push(res.statusCode);
      }
      expect(codes).toEqual([400, 400, 400, 400, 400, 429]);
    } finally {
      await limited.close();
    }
  });
});

describe("GET /auth/claims", () => {
  it("needs sign in, lists only the member's own claims and never returns the storage key", async () => {
    const a = await member("mine");
    const other = await member("other");
    const b1 = await listing();
    const b2 = await listing();
    await claim(b1.slug, a.cookie, { name: "bill.png", type: "image/png", body: PNG });
    await claim(b2.slug, other.cookie);
    expect((await api("GET", "/auth/claims")).status).toBe(401);
    const r = await api("GET", "/auth/claims", { cookie: a.cookie });
    expect(r.status).toBe(200);
    expect(r.body.items).toHaveLength(1);
    expect(r.body.items[0]).toMatchObject({ status: "PENDING", hasProof: true, business: { slug: b1.slug } });
    expect(r.headers["cache-control"]).toBe("no-store");
    expect(JSON.stringify(r.body)).not.toMatch(/proofKey|claims\//);
  });
});

describe("admin side", () => {
  async function pending(label: string, withFile = true, ownerUserId?: string) {
    const m = await member(label);
    const b = await listing(ownerUserId ? { ownerUserId } : {});
    await claim(b.slug, m.cookie, withFile ? { name: "bill.png", type: "image/png", body: PNG } : null);
    const row = await prisma.listingClaimRequest.findFirstOrThrow({ where: { businessId: b.id } });
    return { m, b, row };
  }

  it("lists the claimant account, whether there is a file and the current owner, without the key; still lists old anonymous rows", async () => {
    const holder = await member("holder");
    const { m, b } = await pending("list", true, holder.id);
    const legacyBiz = await listing();
    const legacy = await prisma.listingClaimRequest.create({ data: { businessId: legacyBiz.id, claimantName: "Old", claimantEmail: "old@example.com", proofText: "Receipt" } });
    const r = await api("GET", "/admin/claims?pageSize=100", { token: tokens.MODERATOR });
    expect(r.status).toBe(200);
    const item = r.body.items.find((c: { business: { id: string } }) => c.business.id === b.id);
    expect(item).toMatchObject({ hasProof: true, user: { name: "Member list", email: m.email, postcode: "SA1 4PE" }, business: { owner: { name: "Member holder" } } });
    expect(JSON.stringify(r.body)).not.toMatch(/proofKey|claims\//);
    expect(r.body.items.find((c: { id: string }) => c.id === legacy.id)).toMatchObject({ hasProof: false, user: null });
  });

  it("streams the file to moderators only, with safe headers, and audits each view", async () => {
    const { row } = await pending("view");
    expect((await api("GET", `/admin/claims/${row.id}/proof`, { token: tokens.VOLUNTEER })).status).toBe(403);
    expect((await api("GET", `/admin/claims/${row.id}/proof`)).status).toBe(401);
    expect(await prisma.auditLog.count({ where: { entityId: row.id, action: "claim.proof_viewed" } })).toBe(0);
    const r = await api("GET", `/admin/claims/${row.id}/proof`, { token: tokens.MODERATOR });
    expect(r.status).toBe(200);
    expect(r.headers).toMatchObject({ "content-type": "image/png", "cache-control": "no-store", "x-content-type-options": "nosniff" });
    expect(r.raw.equals(PNG)).toBe(true);
    await api("GET", `/admin/claims/${row.id}/proof`, { token: tokens.MODERATOR });
    expect(await prisma.auditLog.count({ where: { entityId: row.id, action: "claim.proof_viewed" } })).toBe(2);
    const textOnly = await pending("nofile", false);
    expect((await api("GET", `/admin/claims/${textOnly.row.id}/proof`, { token: tokens.MODERATOR })).status).toBe(404);
  });

  it("approving with the link makes the member the owner, and the listing shows under their listings", async () => {
    const { m, b, row } = await pending("approve");
    const r = await api("PATCH", `/admin/claims/${row.id}/approve`, { token: tokens.MODERATOR, body: {} });
    expect(r.status).toBe(200);
    expect((await prisma.business.findUniqueOrThrow({ where: { id: b.id } })).ownerUserId).toBe(m.id);
    const done = await prisma.listingClaimRequest.findUniqueOrThrow({ where: { id: row.id } });
    expect(done).toMatchObject({ status: "APPROVED", linkedOwner: true });
    expect(done.purgeAt!.getTime() - Date.now()).toBeGreaterThan(23 * 3600_000);
    expect(done.purgeAt!.getTime() - Date.now()).toBeLessThan(25 * 3600_000);
    const mine = await api("GET", "/auth/listings", { cookie: m.cookie });
    expect(mine.body.items.map((i: { id: string }) => i.id)).toContain(b.id);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: row.id, action: "APPROVE_CLAIM" } });
    expect(audit.details).toMatchObject({ ownerFrom: null, ownerTo: m.id });
    expect((await api("PATCH", `/admin/claims/${row.id}/approve`, { token: tokens.MODERATOR, body: {} })).status).toBe(409);
    const claims = await api("GET", "/auth/claims", { cookie: m.cookie });
    expect(claims.body.items[0].status).toBe("APPROVED");
  });

  it("can approve without linking, and needs the Replace tick to take a listing from another owner", async () => {
    const noLink = await pending("nolink");
    expect((await api("PATCH", `/admin/claims/${noLink.row.id}/approve`, { token: tokens.MODERATOR, body: { linkOwner: false } })).status).toBe(200);
    expect((await prisma.business.findUniqueOrThrow({ where: { id: noLink.b.id } })).ownerUserId).toBeNull();

    const holder = await member("holder2");
    const { m, b, row } = await pending("replace", true, holder.id);
    const refused = await api("PATCH", `/admin/claims/${row.id}/approve`, { token: tokens.MODERATOR, body: {} });
    expect(refused.status).toBe(409);
    expect(refused.body.error).toBe("This listing already has an owner. Tick Replace owner to change it.");
    expect((await prisma.listingClaimRequest.findUniqueOrThrow({ where: { id: row.id } })).status).toBe("PENDING");
    expect((await prisma.business.findUniqueOrThrow({ where: { id: b.id } })).ownerUserId).toBe(holder.id);
    expect((await api("PATCH", `/admin/claims/${row.id}/approve`, { token: tokens.MODERATOR, body: { replaceOwner: true } })).status).toBe(200);
    expect((await prisma.business.findUniqueOrThrow({ where: { id: b.id } })).ownerUserId).toBe(m.id);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: row.id, action: "APPROVE_CLAIM" } });
    expect(audit.details).toMatchObject({ ownerFrom: holder.id, ownerTo: m.id });
  });

  it("a rejection needs a note, shows it to the member and never links an owner", async () => {
    const { m, b, row } = await pending("reject");
    expect((await api("PATCH", `/admin/claims/${row.id}/reject`, { token: tokens.MODERATOR, body: {} })).status).toBe(400);
    expect((await api("PATCH", `/admin/claims/${row.id}/reject`, { token: tokens.MODERATOR, body: { note: "no" } })).status).toBe(400);
    expect((await api("PATCH", `/admin/claims/${row.id}/reject`, { token: tokens.VOLUNTEER, body: { note: "Not enough evidence." } })).status).toBe(403);
    expect((await api("PATCH", `/admin/claims/${row.id}/reject`, { token: tokens.MODERATOR, body: { note: "The bill is not for this address." } })).status).toBe(200);
    expect((await prisma.business.findUniqueOrThrow({ where: { id: b.id } })).ownerUserId).toBeNull();
    const mine = await api("GET", "/auth/claims", { cookie: m.cookie });
    expect(mine.body.items[0]).toMatchObject({ status: "REJECTED", decisionNote: "The bill is not for this address." });
    // the member can claim again after a refusal
    expect((await claim(b.slug, m.cookie)).status).toBe(201);
  });

  it("deleting the account closes a waiting claim, scrubs the copied details and queues the file for purge", async () => {
    const { row } = await pending("gone");
    const user = await prisma.listingClaimRequest.findUniqueOrThrow({ where: { id: row.id }, select: { userId: true } });
    const u = await prisma.user.findUniqueOrThrow({ where: { id: user.userId! } });
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(PASSWORD) } });
    const cookie = `${SESSION_COOKIE}=${signToken("session", u.id, u.tokenVersion)}`;
    const del = await app.inject({ method: "DELETE", url: "/auth/me", payload: { password: PASSWORD }, headers: { cookie } });
    expect(del.statusCode).toBe(200);
    const after = await prisma.listingClaimRequest.findUniqueOrThrow({ where: { id: row.id } });
    expect(after).toMatchObject({ userId: null, status: "REJECTED", claimantName: "Deleted account", claimantPhone: null });
    expect(after.claimantEmail).toMatch(/@deleted\.invalid$/);
    await purgeExpiredProofs(prisma, storage);
    expect(storage.privateObjects.has(row.proofKey!)).toBe(false);
  });
});
