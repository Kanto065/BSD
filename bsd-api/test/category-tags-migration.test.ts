import { describe, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { CATEGORIES, subcategorySlug } from "../prisma/seed-data.js";
import { OLD_CATEGORIES, oldCategorySlug, oldSubcategorySlug } from "./fixtures/old-taxonomy.js";

// Migration 14_category_service_tags moves a live database from the 20 old categories to the client's Master Category
// Directory, in place, so listings stay attached. This builds a production-like database (the old taxonomy, listings in
// it, an admin-added category) and runs the real migration SQL on it.

vi.setConfig({ testTimeout: 120_000 });

const MIGRATIONS = path.resolve(__dirname, "../prisma/migrations");
const sql = (name: string) => fs.readFileSync(path.join(MIGRATIONS, name, "migration.sql"), "utf8");
const FOLDER = "14_category_service_tags";

async function dbBefore14(): Promise<PGlite> {
  const db = new PGlite();
  const folders = fs
    .readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => parseInt(n, 10) < 14)
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  for (const f of folders) await db.exec(sql(f));
  return db;
}

/** The 20 old categories with their sub-categories, as production has them. */
async function seedOld(db: PGlite) {
  await db.exec(`insert into "CoverageZone"(id,name,slug,"postcodeDistricts") values ('z1','Zone','zone-1',ARRAY['SA1'])`);
  for (const [i, c] of OLD_CATEGORIES.entries()) {
    const slug = oldCategorySlug(c.name);
    await db.query(`insert into "Category"(id,name,slug,icon,"sortOrder","requiresOwnerName") values ($1,$2,$3,$4,$5,$6)`, [
      "old-" + slug, c.name, slug, c.icon ?? null, i, c.requiresOwnerName ?? false,
    ]);
    for (const [j, s] of c.subcategories.entries()) {
      await db.query(`insert into "Subcategory"(id,name,slug,"categoryId","sortOrder") values ($1,$2,$3,$4,$5)`, [
        `oldsub-${oldSubcategorySlug(c.name, s)}`, s, oldSubcategorySlug(c.name, s), "old-" + slug, j,
      ]);
    }
  }
}

let n = 0;
async function listing(db: PGlite, id: string, catSlug: string, subName: string | null) {
  const cat = OLD_CATEGORIES.find((c) => oldCategorySlug(c.name) === catSlug);
  const sub = subName && cat ? `oldsub-${oldSubcategorySlug(cat.name, subName)}` : null;
  await db.query(
    `insert into "Business"(id,slug,name,"categoryId","subcategoryId",description,phone,postcode,"postcodeDistrict","zoneId",status) values ($1,$1,$2,$3,$4,'d','1','SA1 4PE','SA1','z1','APPROVED')`,
    [id, `Listing ${++n}`, catSlug === "driving-school" ? "adm" : "old-" + catSlug, sub]
  );
}

type Snapshot = { categories: unknown[]; subs: unknown[]; businesses: unknown[] };
async function snapshot(db: PGlite): Promise<Snapshot> {
  return {
    categories: (await db.query(`select name,slug,"sortOrder",staged,"serviceTags","requiresOwnerName",status::text from "Category" order by slug`)).rows,
    subs: (await db.query(`select s.name,s.slug,s."sortOrder",c.slug cat from "Subcategory" s join "Category" c on c.id=s."categoryId" order by s.slug`)).rows,
    businesses: (await db.query(`select b.id,c.slug cat,s.name sub from "Business" b join "Category" c on c.id=b."categoryId" left join "Subcategory" s on s.id=b."subcategoryId" order by b.id`)).rows,
  };
}

describe("14_category_service_tags", () => {
  it("adds the columns with safe defaults and touches nothing on an empty database", async () => {
    const db = await dbBefore14();
    await db.exec(sql(FOLDER));
    expect((await db.query<{ n: number }>(`select count(*)::int n from "Category"`)).rows[0]!.n).toBe(0);
    await db.exec(`insert into "Category"(id,name,slug) values ('x','X','x')`);
    expect((await db.query(`select staged,"serviceTags" from "Category" where id='x'`)).rows[0]).toEqual({ staged: false, serviceTags: [] });
    await db.close();
  });

  it("moves a production-like database to the 24 category directory, in place, keeping every listing", async () => {
    const db = await dbBefore14();
    await seedOld(db);
    // an admin added a category on top of the 20 (Others flow), and a suggestion is waiting
    await db.exec(`insert into "Category"(id,name,slug,"sortOrder",status) values ('adm','Driving School','driving-school',20,'APPROVED'),('pend','Pending One','pending-one',21,'PENDING')`);
    await db.exec(`insert into "Subcategory"(id,name,slug,"categoryId") values ('admsub','Learner Lessons','driving-school-learner-lessons','adm')`);

    await listing(db, "l-halal", "groceries-and-halal", "Halal Meat Shops");
    await listing(db, "l-spice", "groceries-and-halal", "Bangladeshi Spices & Essentials");
    await listing(db, "l-taxi", "taxi-and-private-hire", "Airport Transfer Services");
    await listing(db, "l-taxi-nosub", "taxi-and-private-hire", null);
    await listing(db, "l-car", "car-services", "Car Repair");
    await listing(db, "l-bc", "business-consultants", null);
    await listing(db, "l-mort", "legal-and-financial", "Mortgage Advisors");
    await listing(db, "l-acc", "legal-and-financial", "Accountants");
    await listing(db, "l-fit", "fitness-and-wellbeing", "Fitness Trainers");
    await listing(db, "l-elec", "electrician-plumber", "Electricians");
    await listing(db, "l-handy", "trades-and-contractors", "Home Maintenance");
    await listing(db, "l-tutor", "independent-professionals", "Freelance Tutors");
    await listing(db, "l-trade", "independent-professionals", "Tailors (home-based)");
    await listing(db, "l-sweet", "sweet-shops-and-bakeries", "Bangladeshi Sweets");
    await listing(db, "l-others", "others-miscellaneous", "Any service not listed above");
    await listing(db, "l-adm", "driving-school", null);
    await db.exec(`update "Business" set "subcategoryId"='admsub' where id='l-adm'`);

    await db.exec(sql(FOLDER));

    // 1. every directory category is there with its name, slug, order, tags, staged flag and sub-categories in order
    for (const [i, c] of CATEGORIES.entries()) {
      const row = (await db.query<{ id: string; name: string; sortOrder: number; staged: boolean; serviceTags: string[]; requiresOwnerName: boolean; status: string }>(
        `select id,name,"sortOrder",staged,"serviceTags","requiresOwnerName",status::text from "Category" where slug=$1`, [c.slug]
      )).rows[0];
      expect(row, c.slug).toBeDefined();
      expect(row!.name).toBe(c.name);
      expect(row!.sortOrder).toBe(i);
      expect(row!.staged).toBe(!!c.staged);
      expect(row!.serviceTags).toEqual(c.serviceTags);
      expect(row!.requiresOwnerName).toBe(!!c.requiresOwnerName);
      expect(row!.status).toBe("APPROVED");
      const subs = (await db.query<{ name: string; slug: string }>(`select name,slug from "Subcategory" where "categoryId"=$1 order by "sortOrder",name`, [row!.id])).rows;
      expect(subs.map((s) => s.name)).toEqual(c.subcategories);
      expect(subs.map((s) => s.slug)).toEqual(c.subcategories.map((s) => subcategorySlug(c.name, s)));
    }
    expect((await db.query<{ n: number }>(`select count(*)::int n from "Category" where staged`)).rows[0]!.n).toBe(7);
    expect((await db.query<{ n: number }>(`select count(*)::int n from "Subcategory" where name like '~old~%'`)).rows[0]!.n).toBe(0);

    // 2. the four folded categories are gone, nothing else was lost
    const slugs = (await db.query<{ slug: string }>(`select slug from "Category"`)).rows.map((r) => r.slug);
    for (const gone of ["taxi-and-private-hire", "business-consultants", "electrician-plumber", "fitness-and-wellbeing"]) expect(slugs).not.toContain(gone);
    expect(slugs).toContain("driving-school");
    expect(slugs).toContain("pending-one");
    expect(slugs).toHaveLength(25 + 2);

    // 3. admin added category: kept, after the directory, with its own sub-category and listing
    const adm = (await db.query<{ sortOrder: number }>(`select "sortOrder" from "Category" where slug='driving-school'`)).rows[0]!;
    expect(adm.sortOrder).toBeGreaterThanOrEqual(100);
    expect((await db.query<{ name: string }>(`select s.name from "Business" b join "Subcategory" s on s.id=b."subcategoryId" where b.id='l-adm'`)).rows[0]!.name).toBe("Learner Lessons");

    // 4. listings: all still there, in the right category and sub-category
    const where = async (id: string) =>
      (await db.query<{ cat: string; sub: string | null }>(
        `select c.slug cat, s.name sub from "Business" b join "Category" c on c.id=b."categoryId" left join "Subcategory" s on s.id=b."subcategoryId" where b.id=$1`, [id]
      )).rows[0];
    expect((await db.query<{ n: number }>(`select count(*)::int n from "Business"`)).rows[0]!.n).toBe(16);
    expect(await where("l-halal")).toEqual({ cat: "groceries-and-halal", sub: "Halal Meat Shops" });
    expect(await where("l-spice")).toEqual({ cat: "groceries-and-halal", sub: "Specialty Spices & Essentials" });
    expect(await where("l-taxi")).toEqual({ cat: "car-services", sub: "Taxi & Airport Transfers" });
    expect(await where("l-taxi-nosub")).toEqual({ cat: "car-services", sub: null });
    expect(await where("l-car")).toEqual({ cat: "car-services", sub: "Car Repair Garages" });
    expect(await where("l-bc")).toEqual({ cat: "legal-and-financial", sub: "Business Consultants" });
    expect(await where("l-mort")).toEqual({ cat: "property-and-housing-services", sub: "Mortgage Advisors" });
    expect(await where("l-acc")).toEqual({ cat: "legal-and-financial", sub: "Accountants & Tax Advisors" });
    expect(await where("l-fit")).toEqual({ cat: "health-and-care", sub: "Nutrition & Fitness Trainers" });
    expect(await where("l-elec")).toEqual({ cat: "trades-and-contractors", sub: "Electricians" });
    expect(await where("l-handy")).toEqual({ cat: "trades-and-contractors", sub: "Handyman & Painting" });
    expect(await where("l-tutor")).toEqual({ cat: "independent-professionals", sub: null });
    expect(await where("l-trade")).toEqual({ cat: "independent-professionals", sub: "Freelance Tradespeople" });
    expect(await where("l-sweet")).toEqual({ cat: "sweet-shops-and-bakeries", sub: "Bangladeshi Sweets (মিষ্টি)" });
    expect(await where("l-others")).toEqual({ cat: "others-miscellaneous", sub: "Any service not listed above" });

    // 5. Others is as it was, only moved to the end of the directory
    expect((await db.query(`select name,icon,staged,"serviceTags" from "Category" where slug='others-miscellaneous'`)).rows[0]).toEqual({
      name: "Others / Miscellaneous", icon: "package", staged: false, serviceTags: [],
    });

    // 6. running the data part again changes nothing (the migration itself only runs once, this proves it is safe)
    const before = await snapshot(db);
    await db.exec(sql(FOLDER).slice(sql(FOLDER).indexOf("-- M9-B data")));
    expect(await snapshot(db)).toEqual(before);
    await db.close();
  });

  it("does not fail when a new category name is already taken by a different slug", async () => {
    const db = await dbBefore14();
    await seedOld(db);
    await db.exec(`insert into "Category"(id,name,slug,"sortOrder") values ('clash','Digital Services & IT Solutions','my-digital',30)`);
    await db.exec(sql(FOLDER));
    expect((await db.query<{ n: number }>(`select count(*)::int n from "Category" where name='Digital Services & IT Solutions'`)).rows[0]!.n).toBe(1);
    await db.close();
  });
});
