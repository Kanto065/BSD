import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CATEGORIES, ZONES, categorySlug, localitySlug, subcategorySlug } from "../prisma/seed-data.js";
import { MAX_SERVICE_TAGS, cleanTag } from "../src/common/service-tags.js";
import * as webSlug from "../../bsd-web/lib/slug.js";

describe("category taxonomy", () => {
  it("has the client's 24 categories plus Others, with unique names and slugs", () => {
    expect(CATEGORIES).toHaveLength(25);
    expect(new Set(CATEGORIES.map((c) => c.name)).size).toBe(25);
    expect(new Set(CATEGORIES.map((c) => c.slug)).size).toBe(25);
    expect(CATEGORIES[24]!.name).toBe("Others / Miscellaneous");
  });

  it("makes categories 1 to 17 visible and 18 to 24 staged, Others visible", () => {
    expect(CATEGORIES.slice(0, 17).every((c) => !c.staged)).toBe(true);
    expect(CATEGORIES.slice(17, 24).map((c) => c.name)).toEqual([
      "Digital Services & IT Solutions",
      "Insurance & Financial Protection",
      "Health & Medical Professionals",
      "Faith, Education & Cultural Schools",
      "Event Management, Decor & Media",
      "Automobile, Transport & Logistics",
      "Legal, Visa & Family Advisory",
    ]);
    expect(CATEGORIES.slice(17, 24).every((c) => c.staged)).toBe(true);
    expect(CATEGORIES[24]!.staged).toBeFalsy();
  });

  it("uses the client's names in the client's order", () => {
    expect(CATEGORIES.slice(0, 17).map((c) => c.name)).toEqual([
      "Grocery, Halal Meat & Cash Carry",
      "Restaurants, Takeaways & Street Food",
      "Sweet Shops, Desserts & Bakeries",
      "Home-Based Food & Tiffin Services",
      "Clothing, Cultural & Bridal Shops",
      "Hair, Beauty & Grooming Services",
      "Mobile, Tech & Laptop Repairs",
      "Automotive, Garages & Transport",
      "Trades, Repairs & Home Maintenance",
      "Professional, Financial & Remittance - Registered Firms",
      "Travel, Umrah & Cargo Services",
      "Property, Housing & Mortgages",
      "Education, Tutors & Language Classes",
      "Health, Fitness & Care Services",
      "Media, Events & Creative Services",
      "Community, Religious & Voluntary",
      "Independent Professionals (Office-less Hub)- Individual Freelancers",
    ]);
  });

  it("keeps the web address of every category that already existed", () => {
    const kept = [
      "groceries-and-halal", "restaurants-and-takeaways", "sweet-shops-and-bakeries", "home-based-food-services",
      "clothing-and-cultural-shops", "beauty-and-lifestyle", "mobile-and-tech-repair", "car-services", "trades-and-contractors",
      "legal-and-financial", "property-and-housing-services", "tutors-and-education", "health-and-care", "community-and-faith",
      "independent-professionals", "others-miscellaneous",
    ];
    expect(CATEGORIES.map((c) => c.slug)).toEqual(expect.arrayContaining(kept));
    // A new category's slug is what the name gives.
    for (const c of CATEGORIES) if (!kept.includes(c.slug)) expect(c.slug).toBe(categorySlug(c.name));
  });

  it("gives every directory category at least 4 tags, valid and without duplicates", () => {
    for (const c of CATEGORIES.slice(0, 24)) {
      expect(c.serviceTags.length, c.name).toBeGreaterThanOrEqual(4);
      expect(c.serviceTags.length, c.name).toBeLessThanOrEqual(MAX_SERVICE_TAGS);
      expect(new Set(c.serviceTags.map((t) => t.toLowerCase())).size, `duplicate tag in ${c.name}`).toBe(c.serviceTags.length);
      for (const t of c.serviceTags) expect(cleanTag(t), `${c.name} ${t}`).toBe(t);
    }
  });

  it("uses a valid, known icon on every category", () => {
    for (const c of CATEGORIES) expect(c.icon, c.name).toBeTruthy();
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
    expect(CATEGORIES.filter((c) => c.requiresOwnerName).map((c) => c.slug)).toEqual(["independent-professionals"]);
    expect(CATEGORIES.find((c) => c.slug === "independent-professionals")?.subcategories).toHaveLength(4);
  });

  it("does not list a subcategory twice across categories (no duplicate concepts)", () => {
    const all = CATEGORIES.flatMap((c) => c.subcategories);
    expect(new Set(all).size).toBe(all.length);
  });

  it("keeps the sub-categories in the client's document order", () => {
    expect(CATEGORIES[0]!.subcategories).toEqual(["Asian Grocery", "Halal Meat Shops", "Cash & Carry Stores", "Specialty Spices & Essentials"]);
    expect(CATEGORIES[7]!.subcategories).toEqual(["Car Repair Garages", "MOT Centres", "Car Wash & Valeting", "Tyre Shops", "Taxi & Airport Transfers"]);
    expect(CATEGORIES[17]!.subcategories).toEqual([
      "Web & App Development", "Digital Marketing & SEO", "Hardware & IT Support", "AI & Cloud Services", "Graphic & Brand Design",
    ]);
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
      expect(web, `slug for ${c.name}`).toContain(`slug: "${c.slug}"`);
      for (const s of c.subcategories) expect(web, `subcategory ${s}`).toContain(`"${s}"`);
      for (const t of c.serviceTags) expect(web, `tag ${t}`).toContain(`"${t}"`);
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
