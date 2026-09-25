// Same slug rule as bsd-api/src/common/slug.ts. The submission form sends subcategory and locality slugs built with
// it, so the two copies must agree. bsd-api/test/seed-data.test.ts checks they do for every name.
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const subcategorySlug = (categoryName: string, name: string) => slugify(`${categoryName}-${name}`);
export const localitySlug = (name: string) => slugify(name);
