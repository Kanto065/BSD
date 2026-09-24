import { describe, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

// Runs the real migration SQL in PGlite (PostgreSQL compiled to WebAssembly, in process, no server or Docker).
// Production runs PostgreSQL 16, PGlite ships a newer major version, and the migrations are plain DDL, so this
// checks the SQL and the guard behaviour. The full Prisma flow was also run on a real PostgreSQL 16.14, see
// deploy/v2-migration-runbook.md.

// Each test boots its own in-process Postgres (about 5 seconds), so allow plenty of headroom.
vi.setConfig({ testTimeout: 90_000 });

const MIGRATIONS = path.resolve(__dirname, "../prisma/migrations");
const sql = (name: string) => fs.readFileSync(path.join(MIGRATIONS, name, "migration.sql"), "utf8");

const COLUMNS = `select table_name, column_name, data_type, udt_name, is_nullable, coalesce(column_default,'')
  from information_schema.columns where table_schema='public' order by table_name, column_name`;

async function columns(db: PGlite): Promise<string[]> {
  return (await db.query<Record<string, string>>(COLUMNS)).rows.map((r) => Object.values(r).join("|"));
}

async function prodLikeDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(sql("0_init"));
  // Shaped like production on 2026-09-25: 17 categories, 74 subcategories, 8 coverage areas, 1 admin, no listings.
  for (let i = 1; i <= 17; i++) {
    await db.query(`insert into "Category"(id,name,slug,"sortOrder") values ($1,$2,$3,$4)`, ["c" + i, "Cat " + i, "cat-" + i, i]);
  }
  for (let i = 1; i <= 74; i++) {
    await db.query(`insert into "Subcategory"(id,name,slug,"categoryId") values ($1,$2,$3,$4)`, ["s" + i, "Sub " + i, "sub-" + i, "c" + (1 + (i % 17))]);
  }
  for (const t of ["Swansea", "Neath Port Talbot", "Llanelli", "Gorseinon", "Mumbles", "Morriston", "Sketty", "Uplands"]) {
    await db.query(`insert into "CoverageArea"(id,name) values ($1,$1)`, [t]);
  }
  await db.exec(`insert into "AdminUser"(id,name,email,"passwordHash",role) values ('a1','Admin','a@example.com','x','SUPER_ADMIN')`);
  return db;
}

async function enumLabels(db: PGlite, name: string): Promise<string> {
  const r = await db.query<{ enumlabel: string }>(
    `select e.enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname=$1 order by e.enumsortorder`,
    [name]
  );
  return r.rows.map((x) => x.enumlabel).join(",");
}

describe("0_init baseline", () => {
  it("matches the production tables that db push created (79 columns, dumped 2026-09-25)", async () => {
    const db = new PGlite();
    await db.exec(sql("0_init"));
    const mine = await columns(db);
    const prod = fs
      .readFileSync(path.resolve(__dirname, "fixtures/prod-columns-2026-09-25.txt"), "utf8")
      .split(/\r?\n/)
      .filter((l) => l.split("|").length === 6);
    expect(prod).toHaveLength(79);
    expect(mine.filter((l) => !prod.includes(l))).toEqual([]);
    expect(prod.filter((l) => !mine.includes(l))).toEqual([]);
    await db.close();
  });
});

describe("1_v2_schema", () => {
  it("applies on top of production-like data and keeps the existing rows", async () => {
    const db = await prodLikeDb();
    await db.exec(sql("1_v2_schema"));

    const tables = (await db.query<{ table_name: string }>(`select table_name from information_schema.tables where table_schema='public'`)).rows.map((r) => r.table_name);
    expect(tables).not.toContain("CoverageArea");
    expect(tables).not.toContain("BusinessCoverageArea");
    for (const t of ["CoverageZone", "Locality", "BusinessLocality", "BusinessServedZone", "ListingClaimRequest"]) expect(tables).toContain(t);

    const counts = (await db.query<{ c: number; s: number; a: number }>(`select (select count(*) from "Category")::int c, (select count(*) from "Subcategory")::int s, (select count(*) from "AdminUser")::int a`)).rows[0];
    expect(counts).toEqual({ c: 17, s: 74, a: 1 });

    expect(await enumLabels(db, "ContactType")).toBe("SUPPORT,COMPLIANCE,COMMUNITY,ADMIN");
    expect((await enumLabels(db, "AdminRole")).split(",")).toContain("VOLUNTEER");
    expect(await enumLabels(db, "VerificationStatus")).toBe("NEWLY_LISTED,PENDING_VERIFICATION,COMMUNITY_VERIFIED");
    await db.close();
  });

  it("makes postcode, postcodeDistrict and zoneId required and enforces the zone key", async () => {
    const db = await prodLikeDb();
    await db.exec(sql("1_v2_schema"));
    await db.exec(`insert into "CoverageZone"(id,name,slug,"postcodeDistricts") values ('z1','Zone','zone-1',ARRAY['SA1'])`);
    await db.exec(
      `insert into "Business"(id,slug,name,"categoryId",description,phone,postcode,"postcodeDistrict","zoneId") values ('b1','b1','B','c1','d','1','SA1 4PE','SA1','z1')`
    );
    const b = (await db.query<{ status: string; v: string }>(`select status, "verificationStatus" v from "Business" where id='b1'`)).rows[0];
    expect(b).toEqual({ status: "PENDING", v: "NEWLY_LISTED" });
    await expect(
      db.exec(`insert into "Business"(id,slug,name,"categoryId",description,phone,postcode,"postcodeDistrict","zoneId") values ('b2','b2','B','c1','d','1','SA1 1AA','SA1','nope')`)
    ).rejects.toThrow();
    await expect(db.exec(`insert into "Business"(id,slug,name,"categoryId",description,phone) values ('b3','b3','B','c1','d','1')`)).rejects.toThrow();
    await db.close();
  });

  it("aborts cleanly, and changes nothing, if a Business row exists", async () => {
    const db = new PGlite();
    await db.exec(sql("0_init"));
    await db.exec(`insert into "Category"(id,name,slug) values ('c1','C','c'); insert into "Business"(id,slug,name,"categoryId",description,phone) values ('b1','b','B','c1','d','1');`);
    await expect(db.exec(sql("1_v2_schema"))).rejects.toThrow(/"Business" has rows/);
    await db.exec("ROLLBACK"); // the script opens its own transaction, end the aborted one as a fresh connection would
    const still = (await db.query<{ old: number; added: number }>(
      `select (select count(*) from information_schema.tables where table_name='CoverageArea')::int old, (select count(*) from information_schema.columns where table_name='Business' and column_name='postcode')::int added`
    )).rows[0];
    expect(still).toEqual({ old: 1, added: 0 });
    await db.close();
  });

  it("aborts cleanly if a ContactMessage row exists", async () => {
    const db = new PGlite();
    await db.exec(sql("0_init"));
    await db.exec(`insert into "ContactMessage"(id,type,name,email,message) values ('m1','GENERAL','n','e@x.co','hi')`);
    await expect(db.exec(sql("1_v2_schema"))).rejects.toThrow(/"ContactMessage" has rows/);
    await db.close();
  });
});
