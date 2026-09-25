/** URL slug used for categories, subcategories, localities and listings. "Fish & Chips" becomes "fish-and-chips". */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
