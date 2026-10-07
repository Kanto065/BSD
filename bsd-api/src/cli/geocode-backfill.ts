// Fills lat and lng for listings that show their address, from postcodes.io. Safe to run again.
//   npx tsx src/cli/geocode-backfill.ts [--dry-run] [--limit=500]
// Listings that hide their address are skipped and their postcodes are never sent anywhere.
import { PrismaClient } from "@prisma/client";
import { backfillGeocodes } from "../common/geocode.js";

const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const prisma = new PrismaClient();
try {
  const result = await backfillGeocodes(prisma, {
    dryRun: process.argv.includes("--dry-run"),
    limit: limitArg ? Number(limitArg.slice(8)) : undefined,
    log: (l) => console.log(l),
  });
  console.log(JSON.stringify(result));
  if (result.serviceDown) process.exitCode = 2;
} finally {
  await prisma.$disconnect();
}
