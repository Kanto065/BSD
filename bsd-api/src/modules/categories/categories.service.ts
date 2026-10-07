import type { Prisma, PrismaClient } from "@prisma/client";
import { filterConditions, listPublicBusinesses, publicWhere, type Filters } from "../../common/public.js";

// Listing counts only ever count what the public may see.
const publicCount = { _count: { select: { businesses: { where: publicWhere() } } } } as const;
// Admin-set position first, name as the tie-break (all rows share position 0 until someone reorders).
const subcategoryOrder: Prisma.SubcategoryOrderByWithRelationInput[] = [{ sortOrder: "asc" }, { name: "asc" }];

// What the public may see and choose: approved and not staged (hidden until an admin unlocks it). Defined once, the list,
// the category page and the web sitemap all read categories through this. A listing that is already in a category
// that gets staged stays visible, only the category itself leaves the public lists.
export const publicCategory = { status: "APPROVED", staged: false } as const;

const categorySelect = {
  name: true,
  slug: true,
  description: true,
  icon: true,
  sortOrder: true,
  requiresOwnerName: true,
  serviceTags: true,
  ...publicCount,
  subcategories: { orderBy: subcategoryOrder, select: { name: true, slug: true, ...publicCount } },
} as const;

type CategoryRow = {
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  requiresOwnerName: boolean;
  serviceTags: string[];
  _count: { businesses: number };
  subcategories: { name: string; slug: string; _count: { businesses: number } }[];
};

function shape(row: CategoryRow) {
  return {
    name: row.name,
    slug: row.slug,
    description: row.description,
    icon: row.icon,
    sortOrder: row.sortOrder,
    requiresOwnerName: row.requiresOwnerName,
    serviceTags: row.serviceTags,
    businessCount: row._count.businesses,
    subcategories: row.subcategories.map((s) => ({ name: s.name, slug: s.slug, businessCount: s._count.businesses })),
  };
}

export async function listCategories(prisma: PrismaClient) {
  const rows = await prisma.category.findMany({ where: publicCategory, orderBy: { sortOrder: "asc" }, select: categorySelect });
  return rows.map(shape);
}

export async function getCategory(prisma: PrismaClient, slug: string, f: Omit<Filters, "category">) {
  const row = await prisma.category.findFirst({ where: { slug, ...publicCategory }, select: categorySelect });
  if (!row) return null;
  const businesses = await listPublicBusinesses(prisma, await filterConditions(prisma, { ...f, category: slug }), f);
  return { category: shape(row), businesses };
}
