import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { startTestDb, type TestDb } from "./helpers/testdb.js";
import { MemoryStorage } from "../src/common/storage.js";
import { hashPassword } from "../src/common/passwords.js";
import { signToken, SESSION_COOKIE } from "../src/common/tokens.js";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 240_000 });
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-hs256-signing";

let t: TestDb;
let prisma: PrismaClient;
let app: FastifyInstance;
let storage: MemoryStorage;

const PASSWORD = "Correct-Horse-Battery-77";
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(64, 2)]);

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

async function member(label: string) {
  const u = await prisma.user.create({
    data: { name: `Member ${label}`, email: `${label}@test.example`, passwordHash: "x", postcode: "SA1 4PE", postcodeDistrict: "SA1", badges: { create: { badge: "MEMBER" } } },
  });
  return { id: u.id, cookie: `${SESSION_COOKIE}=${signToken("session", u.id, u.tokenVersion)}` };
}

async function upload(cookie: string | undefined, file: { name: string; type: string; body: Buffer } | null = { name: "card.png", type: "image/png", body: PNG }, fields = {}) {
  const m = multipart(file, fields);
  const res = await app.inject({ method: "POST", url: "/student/proof", payload: m.payload, headers: { ...m.headers, ...(cookie ? { cookie } : {}) } });
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null, raw: res.body };
}

async function api(method: "GET" | "POST" | "DELETE", url: string, opts: { cookie?: string; token?: string; body?: object } = {}) {
  const res = await app.inject({
    method,
    url,
    headers: { ...(opts.cookie ? { cookie: opts.cookie } : {}), ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
    ...(opts.body ? { payload: opts.body } : {}),
  });
  return { status: res.statusCode, body: res.rawPayload.length && String(res.headers["content-type"]).includes("json") ? JSON.parse(res.body) : null, headers: res.headers, rawBody: res.rawPayload };
}

const tokens: Record<string, string> = {};
let n = 0;

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

beforeEach(() => {
  storage.failPuts = false;
  n++;
});

describe("member side", () => {
  it("returns 401 on every route when signed out", async () => {
    expect((await api("GET", "/student")).status).toBe(401);
    expect((await upload(undefined)).status).toBe(401);
    expect((await api("DELETE", "/student/proof")).status).toBe(401);
  });

  it("stores a PNG in the private area only, and never returns the key", async () => {
    const m = await member(`a${n}`);
    expect((await api("GET", "/student", { cookie: m.cookie })).body).toEqual({ status: "NONE", verified: false });
    const r = await upload(m.cookie, undefined, { note: "<b>Swansea Uni</b>" });
    expect(r.status).toBe(201);
    expect(r.body.status).toBe("PENDING");
    expect(r.raw).not.toMatch(/proofKey|students\//);
    const row = await prisma.studentVerification.findFirstOrThrow({ where: { userId: m.id } });
    expect(row.proofKey).toMatch(new RegExp(`^students/${m.id}/.+\\.png$`));
    expect(row.note).toBe("Swansea Uni");
    expect(storage.privateObjects.has(row.proofKey!)).toBe(true);
    expect(storage.objects.size).toBe(0);
    expect(row.purgeAt.getTime() - row.submittedAt.getTime()).toBe(7 * 24 * 3600 * 1000);
    const got = await api("GET", "/student", { cookie: m.cookie });
    expect(got.body.status).toBe("PENDING");
    expect(JSON.stringify(got.body)).not.toMatch(/proofKey/);
  });

  it("rejects a text file renamed .png, an empty request and an oversize file", async () => {
    const m = await member(`b${n}`);
    const fake = await upload(m.cookie, { name: "card.png", type: "image/png", body: Buffer.from("just some text, not an image") });
    expect(fake.status).toBe(400);
    expect(fake.body.error).toBe("Upload a JPG, PNG, WebP or PDF file.");
    expect((await upload(m.cookie, null)).status).toBe(400);
    const big = await upload(m.cookie, { name: "big.png", type: "image/png", body: Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]) });
    expect(big.status).toBe(413);
    expect(await prisma.studentVerification.count({ where: { userId: m.id } })).toBe(0);
    expect([...storage.privateObjects.keys()].some((k) => k.includes(m.id))).toBe(false);
  });

  it("accepts a PDF by its signature and blocks a second upload while pending", async () => {
    const m = await member(`c${n}`);
    const ok = await upload(m.cookie, { name: "letter.pdf", type: "application/pdf", body: PDF });
    expect(ok.status).toBe(201);
    expect((await prisma.studentVerification.findFirstOrThrow({ where: { userId: m.id } })).proofType).toBe("application/pdf");
    const again = await upload(m.cookie);
    expect(again.status).toBe(409);
    expect(again.body.error).toBe("You already have a request waiting for review.");
  });

  it("refuses an upload from a verified student", async () => {
    const m = await member(`d${n}`);
    await prisma.userBadge.create({ data: { userId: m.id, badge: "STUDENT" } });
    expect((await upload(m.cookie)).status).toBe(409);
  });

  it("limits uploads to 3 per day", async () => {
    const m = await member(`e${n}`);
    for (let i = 0; i < 3; i++) {
      expect((await upload(m.cookie)).status).toBe(201);
      expect((await api("DELETE", "/student/proof", { cookie: m.cookie })).status).toBe(200);
    }
    expect((await upload(m.cookie)).status).toBe(429);
  });

  it("withdraws a pending request, deleting the object, and allows a new upload", async () => {
    const m = await member(`f${n}`);
    await upload(m.cookie);
    const key = (await prisma.studentVerification.findFirstOrThrow({ where: { userId: m.id } })).proofKey!;
    const w = await api("DELETE", "/student/proof", { cookie: m.cookie });
    expect(w.status).toBe(200);
    expect(w.body.status).toBe("EXPIRED");
    expect(storage.privateObjects.has(key)).toBe(false);
    const row = await prisma.studentVerification.findFirstOrThrow({ where: { userId: m.id } });
    expect(row).toMatchObject({ status: "EXPIRED", proofKey: null });
    expect(row.purgedAt).not.toBeNull();
    expect((await api("DELETE", "/student/proof", { cookie: m.cookie })).status).toBe(404);
    expect((await upload(m.cookie)).status).toBe(201);
  });

  it("keeps one member's request away from another", async () => {
    const a = await member(`g${n}`);
    const b = await member(`h${n}`);
    await upload(a.cookie);
    expect((await api("GET", "/student", { cookie: b.cookie })).body.status).toBe("NONE");
    expect((await api("DELETE", "/student/proof", { cookie: b.cookie })).status).toBe(404);
    expect((await prisma.studentVerification.findFirstOrThrow({ where: { userId: a.id } })).status).toBe("PENDING");
  });

  it("gives a clean 503 and no row when storage is down", async () => {
    const m = await member(`i${n}`);
    storage.failPuts = true;
    expect((await upload(m.cookie)).status).toBe(503);
    expect(await prisma.studentVerification.count({ where: { userId: m.id } })).toBe(0);
  });

});

describe("admin side", () => {
  async function pending(label: string) {
    const m = await member(label);
    await upload(m.cookie);
    const row = await prisma.studentVerification.findFirstOrThrow({ where: { userId: m.id, status: "PENDING" } });
    return { m, row };
  }

  it("keeps a volunteer out and requires sign in", async () => {
    const { row } = await pending(`k${n}`);
    expect((await api("GET", "/admin/students")).status).toBe(401);
    expect((await api("GET", "/admin/students", { token: tokens.VOLUNTEER })).status).toBe(403);
    expect((await api("GET", `/admin/students/${row.id}/proof`, { token: tokens.VOLUNTEER })).status).toBe(403);
    expect((await api("POST", `/admin/students/${row.id}/approve`, { token: tokens.VOLUNTEER })).status).toBe(403);
  });

  it("lists the queue without keys and streams the proof with safe headers, auditing each view", async () => {
    const { row } = await pending(`l${n}`);
    const q = await api("GET", "/admin/students", { token: tokens.MODERATOR });
    expect(q.status).toBe(200);
    const item = q.body.items.find((i: { id: string }) => i.id === row.id);
    expect(item).toMatchObject({ status: "PENDING", proofType: "image/png", hasProof: true });
    expect(item.user.email).toMatch(/@test\.example$/);
    expect(JSON.stringify(q.body)).not.toMatch(/proofKey|students\//);

    const p = await api("GET", `/admin/students/${row.id}/proof`, { token: tokens.MODERATOR });
    expect(p.status).toBe(200);
    expect(p.headers["content-type"]).toBe("image/png");
    expect(p.headers["cache-control"]).toBe("no-store");
    expect(p.headers["x-content-type-options"]).toBe("nosniff");
    expect(p.headers["content-security-policy"]).toBe("sandbox");
    expect(Buffer.compare(p.rawBody, PNG)).toBe(0);
    const logs = await prisma.auditLog.findMany({ where: { action: "student.proof_viewed", entityId: row.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0]!.details).toBeNull();
  });

  it("approves once, grants the badge, sets the purge time and shows on /auth/me", async () => {
    const { m, row } = await pending(`m${n}`);
    const r = await api("POST", `/admin/students/${row.id}/approve`, { token: tokens.MODERATOR });
    expect(r.status).toBe(200);
    const after = await prisma.studentVerification.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.status).toBe("VERIFIED");
    expect(after.decidedById).not.toBeNull();
    expect(Math.abs(after.purgeAt.getTime() - Date.now() - 24 * 3600 * 1000)).toBeLessThan(60_000);
    expect((await api("POST", `/admin/students/${row.id}/approve`, { token: tokens.MODERATOR })).status).toBe(409);
    expect((await api("POST", `/admin/students/${row.id}/reject`, { token: tokens.MODERATOR, body: { reason: "Too late now" } })).status).toBe(409);
    expect((await api("GET", "/auth/me", { cookie: m.cookie })).body.user.badges).toContain("STUDENT");
    expect((await api("GET", "/student", { cookie: m.cookie })).body).toMatchObject({ status: "VERIFIED", verified: true });
    expect(await prisma.auditLog.count({ where: { action: "student.approved", entityId: row.id } })).toBe(1);
  });

  it("rejects only with a reason and grants no badge", async () => {
    const { m, row } = await pending(`n${n}`);
    expect((await api("POST", `/admin/students/${row.id}/reject`, { token: tokens.MODERATOR, body: {} })).status).toBe(400);
    expect((await api("POST", `/admin/students/${row.id}/reject`, { token: tokens.MODERATOR, body: { reason: "abc" } })).status).toBe(400);
    const r = await api("POST", `/admin/students/${row.id}/reject`, { token: tokens.MODERATOR, body: { reason: "The photo is too blurry to read." } });
    expect(r.status).toBe(200);
    const got = await api("GET", "/student", { cookie: m.cookie });
    expect(got.body).toMatchObject({ status: "REJECTED", rejectionReason: "The photo is too blurry to read.", verified: false });
    expect(await prisma.userBadge.count({ where: { userId: m.id, badge: "STUDENT" } })).toBe(0);
    // after a rejection the member may upload again
    expect((await upload(m.cookie)).status).toBe(201);
  });

  it("lets only an admin revoke the badge", async () => {
    const { m, row } = await pending(`o${n}`);
    await api("POST", `/admin/students/${row.id}/approve`, { token: tokens.MODERATOR });
    expect((await api("POST", `/admin/students/${m.id}/revoke`, { token: tokens.MODERATOR })).status).toBe(403);
    expect((await api("POST", `/admin/students/${m.id}/revoke`, { token: tokens.ADMIN })).status).toBe(200);
    expect(await prisma.userBadge.count({ where: { userId: m.id, badge: "STUDENT" } })).toBe(0);
    expect((await api("POST", `/admin/students/${m.id}/revoke`, { token: tokens.ADMIN })).status).toBe(404);
  });

  it("counts waiting requests on the dashboard", async () => {
    await pending(`p${n}`);
    const d = await api("GET", "/admin/dashboard", { token: tokens.VOLUNTEER });
    expect(d.body.pendingStudents).toBe(await prisma.studentVerification.count({ where: { status: "PENDING" } }));
  });

  it("returns 404 for the proof once purged", async () => {
    const { row } = await pending(`q${n}`);
    await prisma.studentVerification.update({ where: { id: row.id }, data: { proofKey: null, purgedAt: new Date() } });
    expect((await api("GET", `/admin/students/${row.id}/proof`, { token: tokens.MODERATOR })).status).toBe(404);
  });
});

// Last on purpose, a failed insert leaves the single shared PGlite session unsettled for the next query.
describe("failure handling", () => {
  it("removes the object again when the database write fails", async () => {
    const m = await member(`j${n}`);
    const before = storage.privateObjects.size;
    // The account disappears while the file is being stored, so the row insert fails on its foreign key.
    const realPut = storage.put.bind(storage);
    const spy = vi.spyOn(storage, "put").mockImplementationOnce(async (input) => {
      await realPut(input);
      await prisma.user.delete({ where: { id: m.id } });
    });
    expect((await upload(m.cookie)).status).toBe(500);
    spy.mockRestore();
    expect(storage.privateObjects.size).toBe(before);
  });
});
