import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { DISTRICT_CENTRES, districtsWithin, haversineMiles, inWalesBox, roundMiles } from "../../common/geo.js";
import { filterConditions, filterQuery, hidesAddress, publicBusinessListSelect, publicWhere, toPublicListItem } from "../../common/public.js";

// Near Me and map pins. Both read only through publicWhere(). A listing that hides its address is ranked by its district
// centre, reports no distance, and is never drawn as a pin. Precise coordinates are used only for listings that show
// their address, and are never put into a response (only a rounded distance, or a pin for a shown address).

export const NEAR_OUTSIDE_MESSAGE = "Near Me works inside the BSD area.";
export const MAX_PINS = 500;
const MAX_CANDIDATES = 3000;

export const nearQuery = z.object({
  lat: z.coerce.number().finite().min(-90).max(90),
  lng: z.coerce.number().finite().min(-180).max(180),
  miles: z.coerce.number().pipe(z.union([z.literal(1), z.literal(5), z.literal(10)])).default(5),
  category: filterQuery.shape.category,
  q: filterQuery.shape.q,
  page: filterQuery.shape.page,
  pageSize: filterQuery.shape.pageSize,
});
export type NearQuery = z.infer<typeof nearQuery>;

export const pinsQuery = z.object({ zone: filterQuery.shape.zone, category: filterQuery.shape.category, q: filterQuery.shape.q });
export type PinsQuery = z.infer<typeof pinsQuery>;

const select = { ...publicBusinessListSelect, lat: true, lng: true } as const;

/** Public listings within `miles` of the point, nearest first. Null when the point is outside the BSD area. */
export async function nearBusinesses(prisma: PrismaClient, f: NearQuery) {
  if (!inWalesBox(f.lat, f.lng)) return null;
  const conds = await filterConditions(prisma, { category: f.category, q: f.q });
  // A box on the indexed columns for listings with a precise point, plus districts whose centre is in range for
  // listings without one (hidden, or not looked up yet). The exact radius is applied below.
  const dLat = f.miles / 69;
  const dLng = f.miles / (69 * Math.max(0.01, Math.cos((f.lat * Math.PI) / 180)));
  const rows = await prisma.business.findMany({
    where: publicWhere({
      AND: [
        ...conds,
        {
          OR: [
            { lat: { gte: f.lat - dLat, lte: f.lat + dLat }, lng: { gte: f.lng - dLng, lte: f.lng + dLng } },
            { lat: null, postcodeDistrict: { in: districtsWithin(f.lat, f.lng, f.miles) } },
          ],
        },
      ],
    }),
    select,
    take: MAX_CANDIDATES,
  });

  const scored: { row: (typeof rows)[number]; miles: number; hidden: boolean; approximate: boolean }[] = [];
  for (const row of rows) {
    const hidden = hidesAddress(row);
    const precise = !hidden && row.lat !== null && row.lng !== null;
    let d: number;
    if (precise) d = haversineMiles(f.lat, f.lng, row.lat!, row.lng!);
    else {
      const c = DISTRICT_CENTRES[row.postcodeDistrict];
      if (!c) continue;
      d = haversineMiles(f.lat, f.lng, c[0], c[1]);
    }
    if (d <= f.miles) scored.push({ row, miles: d, hidden, approximate: !precise });
  }
  scored.sort((a, b) => a.miles - b.miles || a.row.name.localeCompare(b.row.name) || a.row.slug.localeCompare(b.row.slug));

  const start = (f.page - 1) * f.pageSize;
  return {
    items: scored.slice(start, start + f.pageSize).map((s) => ({
      ...toPublicListItem(s.row),
      // A hidden address gives no distance at all. A shown address without a precise point gets a district level one.
      distanceMiles: s.hidden ? null : roundMiles(s.miles),
      distanceApproximate: s.approximate,
    })),
    page: f.page,
    pageSize: f.pageSize,
    total: scored.length,
    totalPages: Math.max(1, Math.ceil(scored.length / f.pageSize)),
    miles: f.miles,
  };
}

const HOME_BASED_ADDRESS = ["homebased", "home based", "home-based"].map((v) => ({ address: { contains: v, mode: "insensitive" as const } }));

/** GeoJSON points for listings that show their address and have a precise point. Hidden ones are only counted. */
export async function mapPins(prisma: PrismaClient, f: PinsQuery) {
  const conds = await filterConditions(prisma, f);
  const [rows, hiddenCount] = await Promise.all([
    prisma.business.findMany({
      where: publicWhere({ AND: [...conds, { lat: { not: null }, lng: { not: null }, hideFullAddress: false }] }),
      select: {
        id: true,
        slug: true,
        name: true,
        verificationStatus: true,
        lat: true,
        lng: true,
        address: true,
        hideFullAddress: true,
        category: { select: { name: true } },
      },
      orderBy: [{ verificationStatus: "desc" }, { name: "asc" }, { slug: "asc" }],
      take: MAX_PINS,
    }),
    prisma.business.count({
      where: publicWhere({ AND: [...conds, { OR: [{ hideFullAddress: true }, { address: null }, ...HOME_BASED_ADDRESS] }] }),
    }),
  ]);
  return {
    type: "FeatureCollection" as const,
    features: rows
      .filter((r) => !hidesAddress(r))
      .map((r) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [r.lng!, r.lat!] },
        properties: { id: r.id, slug: r.slug, name: r.name, categoryName: r.category.name, verificationStatus: r.verificationStatus },
      })),
    meta: { hiddenCount },
  };
}
