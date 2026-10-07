import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { startTestDb, type TestDb } from "./testdb.js";
import { MemoryStorage } from "../../src/common/storage.js";
import { hashPassword } from "../../src/common/passwords.js";
import { signToken, SESSION_COOKIE } from "../../src/common/tokens.js";

// Shared setup for the M11-B tests: a PGlite database, the app, three admin tokens, and small builders for
// members, merchants (an owner with an APPROVED listing) and offers.

export const PASSWORD = "Correct-Horse-Battery-77";
export const DEV = "device-aaaaaaaaaaaaaaaa";

export type Ctx = Awaited<ReturnType<typeof boot>>;

export async function boot() {
  process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-hs256-signing";
  const t: TestDb = await startTestDb();
  process.env.DATABASE_URL = t.url;
  const { PrismaClient: Client } = await import("@prisma/client");
  const prisma: PrismaClient = new Client({ datasources: { db: { url: t.url } } });
  delete process.env.SEED_ADMIN_EMAIL;
  await (await import("../../prisma/seed.js")).runSeed(prisma);
  const hash = await hashPassword(PASSWORD);
  for (const role of ["ADMIN", "MODERATOR", "VOLUNTEER"] as const) {
    await prisma.adminUser.create({ data: { name: role, email: `${role.toLowerCase()}@test.example`, role, passwordHash: hash } });
  }
  const { buildApp } = await import("../../src/server.js");
  const app: FastifyInstance = buildApp({ storage: new MemoryStorage() });
  await app.ready();
  const admins: Record<string, string> = {};
  for (const role of ["ADMIN", "MODERATOR", "VOLUNTEER"]) {
    const r = await app.inject({ method: "POST", url: "/admin/login", payload: { email: `${role.toLowerCase()}@test.example`, password: PASSWORD } });
    admins[role] = JSON.parse(r.body).accessToken;
  }
  let n = 0;

  async function call(method: "GET" | "POST" | "PUT", url: string, o: { cookie?: string; device?: string; admin?: string; body?: object; xff?: string } = {}) {
    const res = await app.inject({
      method,
      url,
      headers: { ...(o.xff ? { "x-forwarded-for": o.xff } : {}), ...(o.cookie ? { cookie: o.cookie } : {}), ...(o.device ? { "x-device": o.device } : {}), ...(o.admin ? { authorization: `Bearer ${admins[o.admin]}` } : {}) },
      ...(o.body ? { payload: o.body } : {}),
    });
    return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : null, raw: res.body };
  }

  async function user(name = "Gwen Jones") {
    n++;
    const u = await prisma.user.create({
      data: { name: `${name} ${n}`, email: `p${n}@test.example`, passwordHash: "x", postcode: "SA1 4PE", postcodeDistrict: "SA1", modules: { create: { module: "CARD" } } },
    });
    return { id: u.id, name: u.name, cookie: `${SESSION_COOKIE}=${signToken("session", u.id, u.tokenVersion)}` };
  }

  /** A member with a claimed pass on DEV. */
  async function holder() {
    const m = await user();
    await call("POST", "/pass/claim", { cookie: m.cookie, body: { agreeShare: true } });
    const tok = await call("GET", "/pass/token", { cookie: m.cookie, device: DEV });
    return { ...m, token: tok.body.token as string };
  }

  /** A merchant: owner of an APPROVED listing, optionally with an offer in the given status. */
  async function shop(offerStatus: "PENDING" | "ACTIVE" | "PAUSED" | "REJECTED" | null = "ACTIVE", over: Record<string, unknown> = {}) {
    const owner = await user("Shop Owner");
    const zone = await prisma.coverageZone.findUniqueOrThrow({ where: { slug: "zone-1" } });
    const category = await prisma.category.findFirstOrThrow({ where: { status: "APPROVED", requiresOwnerName: false } });
    const biz = await prisma.business.create({
      data: {
        slug: `offer-shop-${++n}`, name: `Offer Shop ${n}`, categoryId: category.id, description: "A friendly local shop selling things for the whole community to enjoy every day.",
        servicesOffered: ["Things"], phone: "01792 123 456", postcode: "SA1 4PE", postcodeDistrict: "SA1", zoneId: zone.id, otherAreaText: "Swansea",
        status: "APPROVED", ownerUserId: owner.id, address: "1 High Street", ...over,
      },
    });
    const offer = offerStatus ? await prisma.privilegeOffer.create({ data: { businessId: biz.id, title: "10% off", percent: 10, terms: "Show your pass.", status: offerStatus } }) : null;
    return { owner, biz, offer };
  }

  return { t, prisma, app, call, user, holder, shop, close: async () => { await app.close(); await prisma.$disconnect(); await t.stop(); } };
}
