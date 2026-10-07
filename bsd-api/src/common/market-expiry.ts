import type { PrismaClient } from "@prisma/client";
import type { ObjectStorage } from "./storage.js";

// Daily housekeeping for the marketplace. ACTIVE and RESERVED listings past expiresAt become ARCHIVED. The images of
// ARCHIVED, REMOVED and SOLD listings are deleted 30 days after they closed (the listing row stays). Safe to run twice.

type Log = { error: (obj: object, msg: string) => void };
const DAY = 24 * 60 * 60_000;
export const IMAGE_KEEP_DAYS = 30;

export async function runMarketExpiry(prisma: PrismaClient, storage: ObjectStorage | null, now = new Date(), log?: Log) {
  const archived = await prisma.marketListing.updateMany({
    where: { status: { in: ["ACTIVE", "RESERVED"] }, expiresAt: { lte: now } },
    data: { status: "ARCHIVED", closedAt: now },
  });

  let imagesDeleted = 0;
  if (storage) {
    const old = await prisma.marketImage.findMany({
      where: { listing: { status: { in: ["ARCHIVED", "REMOVED", "SOLD"] }, closedAt: { lte: new Date(now.getTime() - IMAGE_KEEP_DAYS * DAY) } } },
      select: { id: true, key: true, thumbKey: true },
      take: 200,
    });
    for (const img of old) {
      try {
        await storage.delete(img.key);
        await storage.delete(img.thumbKey);
        await prisma.marketImage.delete({ where: { id: img.id } });
        imagesDeleted++;
      } catch {
        log?.error({ imageId: img.id }, "market image purge failed");
      }
    }
  }
  return { archived: archived.count, imagesDeleted };
}

/** Runs now and then daily. ponytail: one API process only, move to cron if that ever changes. */
export function startMarketExpiry(prisma: PrismaClient, storage: ObjectStorage | null, log: Log): NodeJS.Timeout {
  const run = () => void runMarketExpiry(prisma, storage, new Date(), log).catch(() => log.error({}, "market expiry run failed"));
  run();
  const timer = setInterval(run, DAY);
  timer.unref();
  return timer;
}
