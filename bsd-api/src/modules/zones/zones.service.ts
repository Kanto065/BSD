import type { PrismaClient } from "@prisma/client";
import { filterConditions, listPublicBusinesses, publicWhere, type Filters } from "../../common/public.js";

const zoneSelect = {
  name: true,
  slug: true,
  postcodeDistricts: true,
  localities: {
    orderBy: { name: "asc" as const },
    select: {
      name: true,
      slug: true,
      _count: { select: { businesses: { where: { business: publicWhere() } } } },
    },
  },
} as const;

type ZoneRow = {
  name: string;
  slug: string;
  postcodeDistricts: string[];
  localities: { name: string; slug: string; _count: { businesses: number } }[];
};

// A zone's listings are the ones located in it plus the ones that say they serve it.
async function shape(prisma: PrismaClient, row: ZoneRow) {
  const businessCount = await prisma.business.count({
    where: publicWhere({ AND: await filterConditions(prisma, { zone: row.slug }) }),
  });
  return {
    name: row.name,
    slug: row.slug,
    postcodeDistricts: row.postcodeDistricts,
    businessCount,
    localities: row.localities.map((l) => ({ name: l.name, slug: l.slug, businessCount: l._count.businesses })),
  };
}

export async function listZones(prisma: PrismaClient) {
  const rows = await prisma.coverageZone.findMany({ orderBy: { sortOrder: "asc" }, select: zoneSelect });
  return Promise.all(rows.map((r) => shape(prisma, r)));
}

export async function getZone(prisma: PrismaClient, slug: string, f: Omit<Filters, "zone">) {
  const row = await prisma.coverageZone.findUnique({ where: { slug }, select: zoneSelect });
  if (!row) return null;
  const businesses = await listPublicBusinesses(prisma, await filterConditions(prisma, { ...f, zone: slug }), f);
  return { zone: await shape(prisma, row), businesses };
}
