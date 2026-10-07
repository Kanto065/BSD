import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { startTestDb, type TestDb } from "./helpers/testdb.js";
import { MemoryStorage } from "../src/common/storage.js";
import { purgeExpiredProofs } from "../src/common/proof-purge.js";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 240_000 });

let t: TestDb;
let prisma: PrismaClient;
const storage = new MemoryStorage();
const H = 3600 * 1000;
let n = 0;

beforeAll(async () => {
  t = await startTestDb();
  const { PrismaClient: Client } = await import("@prisma/client");
  prisma = new Client({ datasources: { db: { url: t.url } } });
});
afterAll(async () => {
  await prisma?.$disconnect();
  await t?.stop();
});

async function row(status: "PENDING" | "VERIFIED" | "REJECTED", purgeInHours: number, badge = false) {
  n++;
  const u = await prisma.user.create({ data: { name: "U", email: `u${n}@t.example`, passwordHash: "x", postcode: "SA1 1AA", postcodeDistrict: "SA1" } });
  if (badge) await prisma.userBadge.create({ data: { userId: u.id, badge: "STUDENT" } });
  const key = `students/${u.id}/f.png`;
  storage.privateObjects.set(key, { body: Buffer.from("x"), contentType: "image/png" });
  const r = await prisma.studentVerification.create({
    data: { userId: u.id, status, proofKey: key, proofType: "image/png", proofBytes: 1, purgeAt: new Date(Date.now() + purgeInHours * H) },
  });
  return { r, key, userId: u.id };
}

describe("purgeExpiredProofs", () => {
  it("deletes due files and keeps the rest, keeping the decision and the badge", async () => {
    const due = await row("VERIFIED", -1, true);
    const later = await row("VERIFIED", 5);
    expect(await purgeExpiredProofs(prisma, storage)).toBeGreaterThanOrEqual(1);
    expect(storage.privateObjects.has(due.key)).toBe(false);
    expect(storage.privateObjects.has(later.key)).toBe(true);
    const d = await prisma.studentVerification.findUniqueOrThrow({ where: { id: due.r.id } });
    expect(d).toMatchObject({ status: "VERIFIED", proofKey: null });
    expect(d.purgedAt).not.toBeNull();
    expect((await prisma.studentVerification.findUniqueOrThrow({ where: { id: later.r.id } })).proofKey).toBe(later.key);
    expect(await prisma.userBadge.count({ where: { userId: due.userId, badge: "STUDENT" } })).toBe(1);
  });

  it("turns an undecided request past its 7 days into EXPIRED and deletes the file", async () => {
    const old = await row("PENDING", -2);
    await purgeExpiredProofs(prisma, storage);
    expect(storage.privateObjects.has(old.key)).toBe(false);
    expect(await prisma.studentVerification.findUniqueOrThrow({ where: { id: old.r.id } })).toMatchObject({ status: "EXPIRED", proofKey: null });
  });

  it("leaves the row on a storage failure and succeeds on the next run, and twice is harmless", async () => {
    const x = await row("REJECTED", -1);
    storage.failDeletes = true;
    const errors: object[] = [];
    await purgeExpiredProofs(prisma, storage, new Date(), { error: (o) => errors.push(o) });
    storage.failDeletes = false;
    expect(errors).toEqual([{ verificationId: x.r.id }]);
    expect((await prisma.studentVerification.findUniqueOrThrow({ where: { id: x.r.id } })).proofKey).toBe(x.key);
    await purgeExpiredProofs(prisma, storage);
    expect(storage.privateObjects.has(x.key)).toBe(false);
    expect(await purgeExpiredProofs(prisma, storage)).toBe(0);
  });
});
