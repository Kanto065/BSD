import type { PrismaClient } from "@prisma/client";
import {
  filterConditions,
  listPublicBusinesses,
  publicBusinessDetailSelect,
  publicWhere,
  toPublicDetail,
  type Filters,
} from "../../common/public.js";

export async function searchBusinesses(prisma: PrismaClient, f: Filters) {
  return listPublicBusinesses(prisma, await filterConditions(prisma, f), f);
}

/** Homepage "Featured & Verified": only Community Verified listings, most recently verified first. */
export async function featuredBusinesses(prisma: PrismaClient, opts: { limit: number; zone?: string }) {
  return listPublicBusinesses(
    prisma,
    [{ verificationStatus: "COMMUNITY_VERIFIED" }, ...(await filterConditions(prisma, { zone: opts.zone }))],
    { page: 1, pageSize: opts.limit },
    [{ verifiedAt: { sort: "desc", nulls: "last" } }, { name: "asc" }, { slug: "asc" }]
  );
}

/** A single public listing. Anything that is not APPROVED looks exactly like a listing that does not exist. */
export async function getPublicBusiness(prisma: PrismaClient, slug: string) {
  const row = await prisma.business.findFirst({ where: publicWhere({ slug }), select: publicBusinessDetailSelect });
  return row ? toPublicDetail(row) : null;
}
