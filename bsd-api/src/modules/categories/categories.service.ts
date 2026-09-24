import type { PrismaClient } from "@prisma/client";
import { filterConditions, listPublicBusinesses, publicWhere, type Filters } from "../../common/public.js";

// Listing counts only ever count what the public may see.
const publicCount = { _count: { select: { businesses: { where: publicWhere() } } } } as const;

const categorySelect = {
  name: true,
  slug: true,
  description: true,
  icon: true,
  sortOrder: true,
  requiresOwnerName: true,
  ...publicCount,
  subcategories: { orderBy: { name: "asc" as const }, select: { name: true, slug: true, ...publicCount } },
} as const;

type CategoryRow = {
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  requiresOwnerName: boolean;
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
    businessCount: row._count.businesses,
    subcategories: row.subcategories.map((s) => ({ name: s.name, slug: s.slug, businessCount: s._count.businesses })),
  };
}

export async function listCategories(prisma: PrismaClient) {
  const rows = await prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: categorySelect });
  return rows.map(shape);
}

export async function getCategory(prisma: PrismaClient, slug: string, f: Omit<Filters, "category">) {
  const row = await prisma.category.findUnique({ where: { slug }, select: categorySelect });
  if (!row) return null;
  const businesses = await listPublicBusinesses(prisma, await filterConditions(prisma, { ...f, category: slug }), f);
  return { category: shape(row), businesses };
}
