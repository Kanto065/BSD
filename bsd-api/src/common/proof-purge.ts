import type { PrismaClient } from "@prisma/client";
import type { ObjectStorage } from "./storage.js";

// Deletes student proof files and owner claim documents (M9-D) that are due: 24 hours after a decision, or 7 days after upload when nobody decided.
// The row stays (status, dates, who decided) as the record of the decision, only the file goes. Safe to run twice.

type Log = { error: (obj: object, msg: string) => void };

export async function purgeExpiredProofs(prisma: PrismaClient, storage: ObjectStorage, now = new Date(), log?: Log): Promise<number> {
  const due = await prisma.studentVerification.findMany({
    where: { purgeAt: { lte: now }, purgedAt: null, proofKey: { not: null } },
    select: { id: true, status: true, proofKey: true },
    take: 200,
  });
  let purged = 0;
  for (const row of due) {
    try {
      await storage.delete(row.proofKey!, { private: true }); // deleting a missing object is a success
      await prisma.studentVerification.updateMany({
        where: { id: row.id, status: row.status },
        data: { proofKey: null, purgedAt: now, ...(row.status === "PENDING" ? { status: "EXPIRED" } : {}) },
      });
      purged++;
    } catch {
      // Never log the key. The row id is enough, and the next run tries again.
      log?.error({ verificationId: row.id }, "student proof purge failed");
    }
  }
  return purged + (await purgeExpiredClaimProofs(prisma, storage, now, log));
}

// Same rule for claim documents. The claim row and its decision stay, only the file goes. A claim nobody decided
// stays PENDING (the text can still be judged), it just has no file any more.
async function purgeExpiredClaimProofs(prisma: PrismaClient, storage: ObjectStorage, now: Date, log?: Log): Promise<number> {
  const due = await prisma.listingClaimRequest.findMany({
    where: { purgeAt: { lte: now }, purgedAt: null, proofKey: { not: null } },
    select: { id: true, proofKey: true },
    take: 200,
  });
  let purged = 0;
  for (const row of due) {
    try {
      await storage.delete(row.proofKey!, { private: true });
      await prisma.listingClaimRequest.updateMany({ where: { id: row.id }, data: { proofKey: null, purgedAt: now } });
      purged++;
    } catch {
      log?.error({ claimId: row.id }, "claim proof purge failed");
    }
  }
  return purged;
}

const EVERY_MS = 15 * 60 * 1000;

/** Runs the purge now and then every 15 minutes. ponytail: one API process only, move to cron if that ever changes. */
export function startProofPurge(prisma: PrismaClient, storage: ObjectStorage, log: Log): NodeJS.Timeout {
  const run = () => void purgeExpiredProofs(prisma, storage, new Date(), log).catch(() => log.error({}, "student proof purge run failed"));
  run();
  const timer = setInterval(run, EVERY_MS);
  timer.unref();
  return timer;
}
