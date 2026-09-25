import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CATEGORIES, CATEGORY_RENAMES, ZONES, categorySlug, localitySlug, subcategorySlug } from "../prisma/seed-data.js";
import * as webSlug from "../../bsd-web/lib/slug.js";

describe("category taxonomy", () => {
  it("has the 20 approved categories with unique names and slugs", () => {
    expect(CATEGORIES).toHaveLength(20);
    expect(new Set(CATEGORIES.map((c) => c.name)).size).toBe(20);
    expect(new Set(CATEGORIES.map((c) => categorySlug(c.name))).size).toBe(20);
  });

  it("orders the first 14 as the v2 homepage tiles", () => {
    expect(CATEGORIES.slice(0, 14).map((c) => c.name)).toEqual([
      "Restaurants & Takeaways",
      "Legal & Financial",
      "Health & Care",
      "Trades & Contractors",
      "Groceries & Halal",
      "Taxi & Private Hire",
      "Beauty & Lifestyle",
      "Community & Faith",
      "Business Consultants",
      "Mobile & Tech Repair",
      "Clothing & Cultural Shops",
      "Home-Based Food Services",
      "Electrician / Plumber",
      "Independent Professionals",
    ]);
  });

  it("gives every subcategory a globally unique slug and never repeats a name within a category", () => {
    const slugs: string[] = [];
    for (const c of CATEGORIES) {
      expect(new Set(c.subcategories).size, `duplicate subcategory in ${c.name}`).toBe(c.subcategories.length);
      for (const s of c.subcategories) slugs.push(subcategorySlug(c.name, s));
    }
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("flags only Independent Professionals as requiring an owner name", () => {
    expect(CATEGORIES.filter((c) => c.requiresOwnerName).map((c) => c.name)).toEqual(["Independent Professionals"]);
    expect(CATEGORIES.find((c) => c.name === "Independent Professionals")?.subcategories).toHaveLength(16);
  });

  it("does not list a subcategory twice across categories (no duplicate concepts)", () => {
    const all = CATEGORIES.flatMap((c) => c.subcategories);
    expect(new Set(all).size).toBe(all.length);
  });

  it("renames only to approved names, from names that are no longer approved", () => {
    const approved = new Set(CATEGORIES.map((c) => c.name));
    for (const [from, to] of Object.entries(CATEGORY_RENAMES)) {
      expect(approved.has(to), `${to} must be approved`).toBe(true);
      expect(approved.has(from), `${from} must be retired`).toBe(false);
    }
  });

  it("the Others rename changes the name but not the slug, which is why it must rename in place", () => {
    expect(categorySlug("Others/Miscellaneous")).toBe(categorySlug("Others / Miscellaneous"));
  });
});

describe("coverage zones", () => {
  it("has 3 zones with the Factsheet names", () => {
    expect(ZONES.map((z) => [z.slug, z.name])).toEqual([
      ["zone-1", "Greater Swansea & Gower"],
      ["zone-2", "Neath Port Talbot & Swansea Valley"],
      ["zone-3", "Carmarthenshire & West Wales"],
    ]);
  });

  it("covers exactly SA1 to SA20 and SA31 to SA34", () => {
    const all = ZONES.flatMap((z) => z.postcodeDistricts).sort((a, b) => Number(a.slice(2)) - Number(b.slice(2)));
    const expected = [...Array.from({ length: 20 }, (_, i) => `SA${i + 1}`), ...Array.from({ length: 4 }, (_, i) => `SA${31 + i}`)];
    expect(all).toEqual(expected);
  });

  it("has 47 localities (19, 14 and 14) with unique slugs", () => {
    expect(ZONES.map((z) => z.localities.length)).toEqual([19, 14, 14]);
    const slugs = ZONES.flatMap((z) => z.localities.map(localitySlug));
    expect(slugs).toHaveLength(47);
    expect(new Set(slugs).size).toBe(47);
  });

  it("keeps the old 8 towns reachable as localities or folded into one", () => {
    const names = new Set(ZONES.flatMap((z) => z.localities));
    for (const kept of ["Llanelli", "Gorseinon", "Mumbles", "Morriston", "Sketty", "Uplands"]) expect(names.has(kept)).toBe(true);
    expect(names.has("Swansea City Centre")).toBe(true);
    expect(names.has("Neath Town Centre") && names.has("Port Talbot")).toBe(true);
  });
});

// The web app carries a copy of this data until the API-backed pages replace it. Fail loudly if they drift.
describe("bsd-web copy stays in sync", () => {
  const webFile = path.resolve(__dirname, "../../bsd-web/lib/content.ts");
  const web = fs.existsSync(webFile) ? fs.readFileSync(webFile, "utf8") : null;

  it.skipIf(!web)("lists every category, subcategory, zone, district range and locality", () => {
    for (const c of CATEGORIES) {
      expect(web).toContain(`name: "${c.name}"`);
      // The web links filter the API by this slug, so it must be the slug the seed generates.
      expect(web, `slug for ${c.name}`).toContain(`slug: "${categorySlug(c.name)}"`);
      for (const s of c.subcategories) expect(web, `subcategory ${s}`).toContain(`"${s}"`);
    }
    for (const z of ZONES) {
      expect(web).toContain(`name: "${z.name}"`);
      expect(web, `slug for ${z.name}`).toContain(`slug: "${z.slug}"`);
      for (const l of z.localities) expect(web, `locality ${l}`).toContain(`"${l}"`);
    }
  });
});

describe("bsd-web slug rule matches the API", () => {
  it("builds the same subcategory and locality slugs the seed stores", () => {
    for (const c of CATEGORIES) {
      expect(webSlug.slugify(c.name)).toBe(categorySlug(c.name));
      for (const sub of c.subcategories) expect(webSlug.subcategorySlug(c.name, sub)).toBe(subcategorySlug(c.name, sub));
    }
    for (const z of ZONES) for (const l of z.localities) expect(webSlug.localitySlug(l)).toBe(localitySlug(l));
  });
});

describe("category icons", () => {
  it("every seeded icon is allowed, and the website knows every allowed icon", async () => {
    const { CATEGORY_ICONS } = await import("../src/common/category-icons.js");
    for (const c of CATEGORIES) expect(CATEGORY_ICONS as readonly string[], c.name).toContain(c.icon);
    const web = fs.readFileSync(path.resolve(__dirname, "../../bsd-web/lib/category-icons.ts"), "utf8");
    for (const name of CATEGORY_ICONS) {
      const key = name.includes("-") ? `"${name}":` : `${name}:`;
      expect(web, `web icon ${name}`).toContain(key);
    }
  });
});
