import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { searchClause } from "./search.js";

// Everything the public API is allowed to show lives in this file, so the rule "only APPROVED listings, and
// only these fields" has exactly one home. Every public query goes through publicWhere() and one of the
// select objects below. Nothing else in the API reads Business rows for public routes.

/** Restricts a Business query to what the public may see. Extra conditions are ANDed, never replace it. */
export function publicWhere(extra: Prisma.BusinessWhereInput = {}): Prisma.BusinessWhereInput {
  // A listing whose category is still pending (or rejected) stays out of public pages until an admin settles the category.
  return { AND: [{ status: "APPROVED" }, { category: { status: "APPROVED" } }, extra] };
}

const nameSlug = { select: { name: true, slug: true } } as const;

// Deliberately absent from both selects: ownerName, the six consent flags, rejectionReason, reviewedById,
// reviewedAt, verifiedById, submittedAt, and every id.
export const publicBusinessListSelect = {
  slug: true,
  name: true,
  description: true,
  phone: true,
  whatsapp: true,
  address: true,
  postcode: true,
  postcodeDistrict: true,
  hideFullAddress: true,
  verificationStatus: true,
  verifiedAt: true,
  category: nameSlug,
  subcategory: nameSlug,
  zone: nameSlug,
  localities: { select: { locality: nameSlug } },
  photos: { where: { isLogo: true }, select: { url: true, thumbUrl: true }, take: 1 },
} satisfies Prisma.BusinessSelect;

export const publicBusinessDetailSelect = {
  ...publicBusinessListSelect,
  email: true,
  showEmail: true,
  websiteOrSocial: true,
  servicesOffered: true,
  openingHours: true,
  specialNotes: true,
  otherAreaText: true,
  servedZones: { select: { zone: nameSlug } },
  photos: { select: { url: true, thumbUrl: true, isLogo: true, width: true, height: true }, orderBy: { uploadedAt: "asc" } },
} satisfies Prisma.BusinessSelect;

type ListRow = Prisma.BusinessGetPayload<{ select: typeof publicBusinessListSelect }>;
type DetailRow = Prisma.BusinessGetPayload<{ select: typeof publicBusinessDetailSelect }>;

/** Home-based listings hide the full postcode. Public pages show only the district and the locality. */
export function isHomeBased(address: string | null): boolean {
  return !address || /home[\s-]?based/i.test(address);
}

/** A listing keeps its street and full postcode private when the owner ticked the box or wrote HomeBased. */
export function hidesAddress(row: { hideFullAddress: boolean; address: string | null }): boolean {
  return row.hideFullAddress || isHomeBased(row.address);
}

/** "Locality, SA5" when exactly one locality is chosen (localities are areas served, so two or more say nothing), else "SA5". Never the street or full postcode. */
export function areaLabel(row: { postcodeDistrict: string; localities: { locality: { name: string } }[] }): string {
  return row.localities.length === 1 ? `${row.localities[0]!.locality.name}, ${row.postcodeDistrict}` : row.postcodeDistrict;
}

/** The only way an email reaches a public response: the owner's choice (showEmail) decides, and showEmail is never sent itself. */
export function publicEmail(row: { email: string | null; showEmail: boolean }): string | null {
  return row.showEmail && row.email ? row.email : null;
}

const SUMMARY_LENGTH = 200;

function shortText(text: string): string {
  const t = text.trim();
  if (t.length <= SUMMARY_LENGTH) return t;
  return `${t.slice(0, SUMMARY_LENGTH).replace(/\s+\S*$/, "")}...`;
}

export function toPublicListItem(row: ListRow) {
  const hidden = hidesAddress(row);
  return {
    slug: row.slug,
    name: row.name,
    summary: shortText(row.description),
    category: row.category,
    subcategory: row.subcategory,
    zone: row.zone,
    localities: row.localities.map((l) => l.locality),
    postcodeDistrict: row.postcodeDistrict,
    postcode: hidden ? null : row.postcode,
    address: hidden ? null : row.address,
    areaLabel: hidden ? areaLabel(row) : null,
    phone: row.phone,
    whatsapp: row.whatsapp,
    verificationStatus: row.verificationStatus,
    verifiedAt: row.verifiedAt,
    // Cards show the small version when there is one.
    logoUrl: row.photos[0] ? (row.photos[0].thumbUrl ?? row.photos[0].url) : null,
  };
}

export function toPublicDetail(row: DetailRow) {
  const { logoUrl: _omit, ...base } = toPublicListItem({ ...row, photos: row.photos.filter((p) => p.isLogo).slice(0, 1) });
  return {
    ...base,
    description: row.description,
    email: publicEmail(row),
    websiteOrSocial: row.websiteOrSocial,
    servicesOffered: row.servicesOffered,
    openingHours: row.openingHours,
    specialNotes: row.specialNotes,
    otherAreaText: row.otherAreaText,
    servedZones: row.servedZones.map((z) => z.zone),
    logoUrl: row.photos.find((p) => p.isLogo)?.url ?? null,
    photos: row.photos.map((p) => ({ url: p.url, thumbUrl: p.thumbUrl, isLogo: p.isLogo, width: p.width, height: p.height })),
  };
}

// ---------------------------------------------------------------------------
// Query parsing and filtering
// ---------------------------------------------------------------------------

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{1,100}$/, "must be a slug");

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

export const filterQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  category: slug.optional(),
  subcategory: slug.optional(),
  zone: slug.optional(),
  locality: slug.optional(),
});

export type Filters = z.infer<typeof filterQuery>;

/** Turns a zod failure into the 400 body every public route returns. */
export function badQuery(error: z.ZodError) {
  return { error: "Invalid query", details: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) };
}

/** Filters shared by search, category pages and zone pages. A zone matches where the business is or where it says it serves. */
export async function filterConditions(prisma: PrismaClient, f: Partial<Filters>): Promise<Prisma.BusinessWhereInput[]> {
  const c: Prisma.BusinessWhereInput[] = [];
  if (f.category) c.push({ category: { slug: f.category } });
  if (f.subcategory) c.push({ subcategory: { slug: f.subcategory } });
  if (f.zone) c.push({ OR: [{ zone: { slug: f.zone } }, { servedZones: { some: { zone: { slug: f.zone } } } }] });
  if (f.locality) c.push({ localities: { some: { locality: { slug: f.locality } } } });
  if (f.q) c.push(...(await searchClause(prisma, f.q)));
  return c;
}

export type Page<T> = { items: T[]; page: number; pageSize: number; total: number; totalPages: number };

/** Verified listings first, then alphabetical, so the order is stable between pages. */
const ORDER: Prisma.BusinessOrderByWithRelationInput[] = [{ verificationStatus: "desc" }, { name: "asc" }, { slug: "asc" }];

export async function listPublicBusinesses(
  prisma: PrismaClient,
  extra: Prisma.BusinessWhereInput[],
  paging: { page: number; pageSize: number },
  orderBy: Prisma.BusinessOrderByWithRelationInput[] = ORDER
): Promise<Page<ReturnType<typeof toPublicListItem>>> {
  const where = publicWhere({ AND: extra });
  const [total, rows] = await prisma.$transaction([
    prisma.business.count({ where }),
    prisma.business.findMany({
      where,
      select: publicBusinessListSelect,
      orderBy,
      skip: (paging.page - 1) * paging.pageSize,
      take: paging.pageSize,
    }),
  ]);
  return {
    items: rows.map(toPublicListItem),
    page: paging.page,
    pageSize: paging.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / paging.pageSize)),
  };
}
