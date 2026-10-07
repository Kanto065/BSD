import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { startTestDb, type TestDb } from "./helpers/testdb.js";
import { MemoryStorage } from "../src/common/storage.js";
import { runMarketExpiry } from "../src/common/market-expiry.js";
import { makeMember } from "./helpers/market.js";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 240_000 });
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-hs256-signing";

let t: TestDb;
let prisma: PrismaClient;
const DAY = 86400_000;

beforeAll(async () => {
  t = await startTestDb();
  const { PrismaClient: Client } = await import("@prisma/client");
  prisma = new Client({ datasources: { db: { url: t.url } } });
});
afterAll(async () => {
  await prisma?.$disconnect();
  await t?.stop();
});

describe("market expiry job", () => {
  it("archives expired ACTIVE and RESERVED listings only, then deletes images 30 days after closing, twice safely", async () => {
    const m = await makeMember(prisma, "exp");
    const cat = await prisma.marketCategory.findFirstOrThrow();
    const storage = new MemoryStorage();
    const now = new Date();
    const base = { ownerUserId: m.id, kind: "SELL" as const, title: "Thing", description: "x".repeat(30), categoryId: cat.id, postcode: "SA1 4PE", postcodeDistrict: "SA1", whatsapp: "07700900123" };
    const mk = (slug: string, status: "ACTIVE" | "RESERVED" | "PENDING" | "ARCHIVED" | "REMOVED", expiresAt: Date, closedAt?: Date) =>
      prisma.marketListing.create({
        data: { ...base, slug, status, expiresAt, closedAt, images: { create: [{ key: `market/${slug}.webp`, thumbKey: `market/${slug}-t.webp`, width: 10, height: 10 }] } },
      });
    await mk("a-expired", "ACTIVE", new Date(now.getTime() - 1000));
    await mk("a-reserved-expired", "RESERVED", new Date(now.getTime() - 1000));
    await mk("a-live", "ACTIVE", new Date(now.getTime() + DAY));
    await mk("a-pending-old", "PENDING", new Date(now.getTime() - 1000));
    await mk("a-old-archived", "ARCHIVED", new Date(now.getTime() - 40 * DAY), new Date(now.getTime() - 31 * DAY));
    await mk("a-old-removed", "REMOVED", new Date(now.getTime() + DAY), new Date(now.getTime() - 31 * DAY));
    await mk("a-recent-archived", "ARCHIVED", new Date(now.getTime() - 5 * DAY), new Date(now.getTime() - 5 * DAY));
    for (const s of ["a-old-archived", "a-old-removed", "a-recent-archived", "a-expired"]) {
      await storage.put({ key: `market/${s}.webp`, body: Buffer.from("x"), contentType: "image/webp" });
      await storage.put({ key: `market/${s}-t.webp`, body: Buffer.from("x"), contentType: "image/webp" });
    }

    const first = await runMarketExpiry(prisma, storage, now);
    expect(first).toEqual({ archived: 2, imagesDeleted: 2 });
    const status = async (slug: string) => (await prisma.marketListing.findUniqueOrThrow({ where: { slug } })).status;
    expect(await status("a-expired")).toBe("ARCHIVED");
    expect(await status("a-reserved-expired")).toBe("ARCHIVED");
    expect(await status("a-live")).toBe("ACTIVE");
    expect(await status("a-pending-old")).toBe("PENDING");
    expect([...storage.objects.keys()].sort()).toEqual(["market/a-expired-t.webp", "market/a-expired.webp", "market/a-recent-archived-t.webp", "market/a-recent-archived.webp"]);
    expect(await prisma.marketImage.count({ where: { listing: { slug: { in: ["a-old-archived", "a-old-removed"] } } } })).toBe(0);
    expect(await runMarketExpiry(prisma, storage, now)).toEqual({ archived: 0, imagesDeleted: 0 });
    // 31 days later the freshly archived ones lose their images too.
    expect((await runMarketExpiry(prisma, storage, new Date(now.getTime() + 31 * DAY))).imagesDeleted).toBeGreaterThanOrEqual(2);
  });
});
