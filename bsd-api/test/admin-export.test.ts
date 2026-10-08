import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { startTestDb, type TestDb } from "./helpers/testdb.js";
import { MemoryStorage } from "../src/common/storage.js";
import { hashPassword } from "../src/common/passwords.js";
import { csvCell } from "../src/modules/admin/admin.export.js";

// M7: the print export follows the public privacy rules and is safe to open in Excel.

vi.setConfig({ testTimeout: 60_000, hookTimeout: 240_000 });
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-hs256-signing";

let t: TestDb;
let prisma: PrismaClient;
let app: FastifyInstance;
const tokens: Record<string, string> = {};
const PASSWORD = "Correct-Horse-Battery-77";
const STREET = "77 Secret Lane";
const FULLPC = "SA1 4PE";
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
let n = 0;

async function make(over: Record<string, unknown> = {}) {
  const zone = await prisma.coverageZone.findUniqueOrThrow({ where: { slug: "zone-1" } });
  const category = await prisma.category.findFirstOrThrow({ where: { status: "APPROVED", requiresOwnerName: false } });
  return prisma.business.create({
    data: {
      slug: `exp-${++n}`, name: `Export Test ${n}`, categoryId: category.id, description: `A small shop. ${words(30)}`,
      servicesOffered: ["Bread"], phone: "01792 123 456", address: STREET, postcode: FULLPC, postcodeDistrict: "SA1", zoneId: zone.id,
      status: "APPROVED", ...over,
    },
  });
}
const get = (url: string, role?: string) =>
  app.inject({ method: "GET", url, headers: role ? { authorization: `Bearer ${tokens[role]}` } : {} });

beforeAll(async () => {
  t = await startTestDb();
  process.env.DATABASE_URL = t.url;
  const { PrismaClient: Client } = await import("@prisma/client");
  prisma = new Client({ datasources: { db: { url: t.url } } });
  delete process.env.SEED_ADMIN_EMAIL;
  await (await import("../prisma/seed.js")).runSeed(prisma);
  const hash = await hashPassword(PASSWORD);
  for (const role of ["ADMIN", "MODERATOR"] as const) {
    await prisma.adminUser.create({ data: { name: role, email: `${role.toLowerCase()}@test.example`, role, passwordHash: hash } });
  }
  const { buildApp } = await import("../src/server.js");
  app = buildApp({ storage: new MemoryStorage() });
  await app.ready();
  for (const role of ["ADMIN", "MODERATOR"]) {
    const r = await app.inject({ method: "POST", url: "/admin/login", payload: { email: `${role.toLowerCase()}@test.example`, password: PASSWORD } });
    tokens[role] = JSON.parse(r.body).accessToken;
  }
});
afterAll(async () => {
  await app?.close();
  await prisma?.$disconnect();
  await t?.stop();
});

describe("print export", () => {
  it("is ADMIN and above only", async () => {
    expect((await get("/admin/export/listings")).statusCode).toBe(401);
    expect((await get("/admin/export/listings", "MODERATOR")).statusCode).toBe(403);
    expect((await get("/admin/export/listings?format=xml", "ADMIN")).statusCode).toBe(400);
  });

  it("never exports a hidden address or a hidden email, and only approved listings", async () => {
    await make({ name: "Open Shop", email: "open@secret-mail.example", showEmail: true });
    await make({ name: "Hidden Shop", hideFullAddress: true, email: "hidden@secret-mail.example", showEmail: false, address: "9 Hidden Street" });
    await make({ name: "Home Shop", address: "HomeBased", email: "home@secret-mail.example", showEmail: false });
    await make({ name: "Pending Shop", status: "PENDING" });
    for (const format of ["csv", "json"]) {
      const res = await get(`/admin/export/listings?format=${format}`, "ADMIN");
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-disposition"]).toContain("attachment");
      const text = res.body;
      expect(text).toContain("Open Shop");
      expect(text).toContain("open@secret-mail.example");
      expect(text).toContain(STREET);
      expect(text).toContain("Hidden Shop");
      expect(text).not.toContain("9 Hidden Street");
      expect(text).not.toContain("hidden@secret-mail.example");
      expect(text).not.toContain("home@secret-mail.example");
      expect(text).not.toContain("Pending Shop");
      // The full postcode appears once, for the one listing that shows its address.
      expect(text.split(FULLPC).length - 1).toBe(1);
    }
  });

  it("csv has a BOM, quotes fields and neutralises formulas; json is grouped; the export is audited", async () => {
    await make({ name: '=HYPERLINK("http://x")', description: `Says "hi", then more. ${words(30)}` });
    const csv = (await get("/admin/export/listings?format=csv", "ADMIN")).body;
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(csv).toContain(`"Says ""hi"", then more.`);
    const json = JSON.parse((await get("/admin/export/listings?format=json", "ADMIN")).body);
    expect(json.zones[0].categories[0].listings[0]).toHaveProperty("Name");
    expect(json.total).toBeGreaterThanOrEqual(4);
    expect(await prisma.auditLog.count({ where: { action: "export.listings" } })).toBeGreaterThanOrEqual(3);
  });

  it("csvCell guards every formula starter", () => {
    for (const s of ["=1", "+1", "-1", "@x", "\tx"]) expect(csvCell(s)).toBe(`"'${s}"`);
    expect(csvCell("plain")).toBe(`"plain"`);
  });
});
