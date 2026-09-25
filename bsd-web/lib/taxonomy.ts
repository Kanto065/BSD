import type { LucideIcon } from "lucide-react";
import { apiGet } from "@/lib/api";
import { CATEGORIES } from "@/lib/content";
import { iconFor } from "@/lib/category-icons";
import { subcategorySlug } from "@/lib/slug";

// Categories as managed in the admin panel, read from the public API and cached for a minute. If the API cannot be
// reached (or the site is being built) the built-in list in lib/content.ts is used instead, so pages always render.

export type SubcategoryOption = { name: string; slug: string };

/** Plain data, safe to pass to browser components (the submission and admin forms). */
export type CategoryOption = {
  name: string;
  slug: string;
  description: string | null;
  requiresOwnerName: boolean;
  subcategories: SubcategoryOption[];
};

/** For server-rendered pages: the same data plus the icon component. */
export type Taxon = CategoryOption & { icon: LucideIcon };

type ApiCategory = {
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  requiresOwnerName: boolean;
  subcategories: { name: string; slug: string }[];
};

const fallback: Taxon[] = CATEGORIES.map((c) => ({
  name: c.name,
  slug: c.slug,
  description: null,
  icon: c.icon,
  requiresOwnerName: c.slug === "independent-professionals",
  subcategories: c.subcategories.map((s) => ({ name: s, slug: subcategorySlug(c.name, s) })),
}));

export async function getCategories(): Promise<Taxon[]> {
  const r = await apiGet<{ categories: ApiCategory[] }>("/categories");
  if (!r.ok || !r.data.categories.length) return fallback;
  return r.data.categories.map((c) => ({
    name: c.name,
    slug: c.slug,
    description: c.description,
    // A category without a stored icon keeps its original built-in one, if it has one.
    icon: c.icon ? iconFor(c.icon) : (fallback.find((f) => f.slug === c.slug)?.icon ?? iconFor(null)),
    requiresOwnerName: c.requiresOwnerName,
    subcategories: c.subcategories.map((s) => ({ name: s.name, slug: s.slug })),
  }));
}

export const toOptions = (list: Taxon[]): CategoryOption[] =>
  list.map(({ icon: _icon, ...rest }) => rest);

/** Number of category tiles on the homepage: the first ones in the admin panel's order. */
export const HOMEPAGE_TILES = 14;
