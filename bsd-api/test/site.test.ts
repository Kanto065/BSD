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
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null, headers: res.headers };
}

beforeAll(async () => {
  t = await startTestDb();
  process.env.DATABASE_URL = t.url;
  const { PrismaClient: Client } = await import("@prisma/client");
  prisma = new Client({ datasources: { db: { url: t.url } } });
  const hash = await hashPassword(PASSWORD);
  for (const role of ["ADMIN", "MODERATOR"]) await prisma.adminUser.create({ data: { name: role, email: `${role.toLowerCase()}@t.example`, role: role as "ADMIN", passwordHash: hash } });
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

describe("public site config", () => {
  it("equals today's site when the table is empty, and is cached for 60 seconds", async () => {
    const r = await call("GET", "/site/config");
    expect(r.status).toBe(200);
    expect(r.headers["cache-control"]).toBe("public, max-age=60");
    expect(r.body.maintenance).toEqual({ enabled: false, textEn: "", textBn: "" });
    expect(r.body.overridden).toEqual([]);
    expect(r.body.homeOrder).toEqual(["home-categories", "home-zones", "home-featured", "home-owner", "home-how", "home-faq"]);
    expect(Object.values(r.body.sections).every((s: any) => s.visible && s.title === null && s.body === null)).toBe(true);
  });

  it("falls back to defaults when a stored value is corrupt", async () => {
    await prisma.siteSetting.create({ data: { key: "maintenance", value: { enabled: "yes" } } });
    expect((await call("GET", "/site/config")).body.maintenance.enabled).toBe(false);
    await prisma.siteSetting.delete({ where: { key: "maintenance" } });
  });
});

describe("admin site endpoints", () => {
  it("needs an admin", async () => {
    expect((await call("GET", "/admin/site")).status).toBe(401);
    expect((await call("GET", "/admin/site", tokens.MODERATOR)).status).toBe(403);
    expect((await call("PUT", "/admin/site/maintenance", tokens.MODERATOR, { enabled: false, textEn: "", textBn: "" })).status).toBe(403);
  });

  it("saves the banner as plain text, audits it, and rejects bad input", async () => {
    const ok = await call("PUT", "/admin/site/maintenance", tokens.ADMIN, { enabled: true, textEn: "Back soon <b>today</b><script>x()</script>", textBn: "" });
    expect(ok.status).toBe(200);
    expect(ok.body.maintenance).toEqual({ enabled: true, textEn: "Back soon today", textBn: "" });
    expect((await call("GET", "/site/config")).body.overridden).toContain("maintenance");
    expect(await prisma.auditLog.count({ where: { action: "UPDATE_SITE_MAINTENANCE" } })).toBe(1);
    expect((await call("PUT", "/admin/site/maintenance", tokens.ADMIN, { enabled: true, textEn: "x".repeat(201), textBn: "" })).status).toBe(400);
    expect((await call("PUT", "/admin/site/maintenance", tokens.ADMIN, { enabled: true, textEn: "  ", textBn: "" })).status).toBe(400);
    expect((await call("PUT", "/admin/site/maintenance", tokens.ADMIN, { enabled: true, textEn: "a", textBn: "", extra: 1 })).status).toBe(400);
  });

  it("hides, orders and edits sections within the whitelist", async () => {
    const ok = await call("PUT", "/admin/site/sections", tokens.ADMIN, {
      items: { about: { visible: false, title: null, body: null }, "home-faq": { visible: true, title: "Questions <i>people</i> ask", body: null } },
      order: ["home-faq", "home-zones"],
    });
    expect(ok.status).toBe(200);
    expect(ok.body.sections.about.visible).toBe(false);
    expect(ok.body.sections["home-faq"].title).toBe("Questions people ask");
    expect(ok.body.homeOrder).toEqual(["home-faq", "home-zones", "home-categories", "home-featured", "home-owner", "home-how"]);
    expect(await prisma.auditLog.count({ where: { action: "UPDATE_SITE_SECTIONS" } })).toBe(1);
  });

  it("refuses locked, unknown, over-long and non-home order changes", async () => {
    const put = (b: unknown) => call("PUT", "/admin/site/sections", tokens.ADMIN, b);
    expect((await put({ items: { privacy: { visible: false, title: null, body: null } }, order: [] })).status).toBe(400);
    expect((await put({ items: { nope: { visible: true, title: null, body: null } }, order: [] })).status).toBe(400);
    expect((await put({ items: { about: { visible: true, title: "New", body: null } }, order: [] })).status).toBe(400);
    expect((await put({ items: { "home-faq": { visible: true, title: "x".repeat(81), body: null } }, order: [] })).status).toBe(400);
    expect((await put({ items: { "home-faq": { visible: true, title: null, body: "no body field" } }, order: [] })).status).toBe(400);
    expect((await put({ items: {}, order: ["footer-cta"] })).status).toBe(400);
    // a locked section may be saved as visible
    expect((await put({ items: { privacy: { visible: true, title: null, body: null } }, order: [] })).status).toBe(200);
  });
});
