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

describe("5_subcategory_order", () => {
  it("adds the position column and starts each category's subcategories in today's alphabetical order", async () => {
    const db = new PGlite();
    for (const m of ["0_init", "1_v2_schema", "2_photo_variants", "3_admin_auth", "4_request_contacts"]) await db.exec(sql(m));
    await db.exec(`insert into "Category"(id,name,slug) values ('c1','One','one'),('c2','Two','two')`);
    await db.exec(`insert into "Subcategory"(id,name,slug,"categoryId") values
      ('s1','Tailors','t','c1'),('s2','Barbers','b','c1'),('s3','Henna','h','c1'),('s4','Zebra','z','c2'),('s5','Apple','a','c2')`);
    await db.exec(sql("5_subcategory_order"));
    const rows = (await db.query<{ id: string; p: number }>(`select id, "sortOrder" p from "Subcategory" order by "categoryId", "sortOrder"`)).rows;
    expect(rows).toEqual([
      { id: "s2", p: 0 },
      { id: "s3", p: 1 },
      { id: "s1", p: 2 },
      { id: "s5", p: 0 },
      { id: "s4", p: 1 },
    ]);
    // new rows default to 0 and the column is required
    await db.exec(`insert into "Subcategory"(id,name,slug,"categoryId") values ('s6','New','n','c1')`);
    expect((await db.query<{ p: number }>(`select "sortOrder" p from "Subcategory" where id='s6'`)).rows[0]!.p).toBe(0);
    await db.close();
  });
});

describe("7_business_email_visibility", () => {
  it("keeps today's behaviour for listings that show an email, and hides new ones by default", async () => {
    const db = await prodLikeDb();
    for (const m of ["1_v2_schema", "2_photo_variants", "3_admin_auth", "4_request_contacts", "5_subcategory_order", "6_member_accounts"]) await db.exec(sql(m));
    await db.exec(`insert into "CoverageZone"(id,name,slug,"postcodeDistricts") values ('z1','Zone','zone-1',ARRAY['SA1'])`);
    const insert = (id: string, email: string | null) =>
      db.query(
        `insert into "Business"(id,slug,name,"categoryId",description,phone,postcode,"postcodeDistrict","zoneId",email) values ($1,$1,'B','c1','d','1','SA1 4PE','SA1','z1',$2)`,
        [id, email]
      );
    await insert("with-email", "owner@example.com");
    await insert("null-email", null);
    await insert("empty-email", "");

    await db.exec(sql("7_business_email_visibility"));

    const rows = (await db.query<{ id: string; showEmail: boolean }>(`select id, "showEmail" from "Business" order by id`)).rows;
    expect(Object.fromEntries(rows.map((r) => [r.id, r.showEmail]))).toEqual({ "with-email": true, "null-email": false, "empty-email": false });

    await insert("fresh", "new@example.com");
    expect((await db.query<{ s: boolean }>(`select "showEmail" s from "Business" where id='fresh'`)).rows[0]!.s).toBe(false);
    // the addresses themselves are untouched
    expect((await db.query<{ n: number }>(`select count(*)::int n from "Business" where email is not null and email <> ''`)).rows[0]!.n).toBe(2);
    await db.close();
  });
});

describe("10_member_profiles", () => {
  it("keeps existing users and listings, defaults them to GENERAL with no owner, and adds the profile table", async () => {
    const db = await prodLikeDb();
    for (const m of ["1_v2_schema", "2_photo_variants", "3_admin_auth", "4_request_contacts", "5_subcategory_order", "6_member_accounts", "7_business_email_visibility", "8_site_settings", "9_category_others"]) await db.exec(sql(m));
    await db.exec(`insert into "CoverageZone"(id,name,slug,"postcodeDistricts") values ('z1','Zone','zone-1',ARRAY['SA1'])`);
    await db.exec(`insert into "User"(id,name,email,"passwordHash",postcode,"postcodeDistrict") values ('u1','Member','m@example.com','x','SA1 4PE','SA1')`);
    await db.exec(
      `insert into "Business"(id,slug,name,"categoryId",description,phone,postcode,"postcodeDistrict","zoneId") values ('b1','b1','B','c1','d','1','SA1 4PE','SA1','z1')`
    );

    await db.exec(sql("10_member_profiles"));

    expect(await enumLabels(db, "AccountType")).toBe("GENERAL,STUDENT");
    expect((await db.query<{ t: string; p: string | null }>(`select "accountType"::text t, phone p from "User" where id='u1'`)).rows[0]).toEqual({ t: "GENERAL", p: null });
    expect((await db.query<{ o: string | null; e: string | null }>(`select "ownerUserId" o, "ownerEditedAt" e from "Business" where id='b1'`)).rows[0]).toEqual({ o: null, e: null });
    expect((await db.query<{ s: string | null }>(`select "submittedByUserId" s from "Category" where id='c1'`)).rows[0]!.s).toBeNull();

    // one profile row per user, removed with the user
    await db.exec(`insert into "BusinessProfile"("userId",data,"updatedAt") values ('u1','{}',now())`);
    await expect(db.exec(`insert into "BusinessProfile"("userId",data,"updatedAt") values ('u1','{}',now())`)).rejects.toThrow();
    // deleting the owner keeps the listing and clears the link
    await db.exec(`update "Business" set "ownerUserId"='u1' where id='b1'`);
    await db.exec(`delete from "User" where id='u1'`);
    expect((await db.query<{ n: number }>(`select count(*)::int n from "BusinessProfile"`)).rows[0]!.n).toBe(0);
    expect((await db.query<{ o: string | null }>(`select "ownerUserId" o from "Business" where id='b1'`)).rows[0]!.o).toBeNull();
    await db.close();
  });
});

describe("9_category_others", () => {
  it("marks every existing category APPROVED and defaults new ones to APPROVED", async () => {
    const db = await prodLikeDb();
    for (const m of ["1_v2_schema", "2_photo_variants", "3_admin_auth", "4_request_contacts", "5_subcategory_order", "6_member_accounts", "7_business_email_visibility"]) await db.exec(sql(m));
    await db.exec(sql("9_category_others"));
    expect(await enumLabels(db, "CategoryStatus")).toBe("APPROVED,PENDING,REJECTED");
    const r = (await db.query<{ n: number; a: number; s: number }>(`select count(*)::int n, count(*) filter (where status='APPROVED')::int a, count("submittedAt")::int s from "Category"`)).rows[0]!;
    expect(r).toEqual({ n: 17, a: 17, s: 0 });
    await db.exec(`insert into "Category"(id,name,slug) values ('new','New','new')`);
    expect((await db.query<{ status: string }>(`select status from "Category" where id='new'`)).rows[0]!.status).toBe("APPROVED");
    await db.close();
  });
});

describe("11_student_verification", () => {
  it("creates the table and allows only one PENDING request per member", async () => {
    const db = await prodLikeDb();
    for (const m of ["1_v2_schema", "2_photo_variants", "3_admin_auth", "4_request_contacts", "5_subcategory_order", "6_member_accounts", "7_business_email_visibility", "8_site_settings", "9_category_others"]) await db.exec(sql(m));
    await db.exec(sql("11_student_verification"));
    expect(await enumLabels(db, "StudentStatus")).toBe("PENDING,VERIFIED,REJECTED,EXPIRED");
    await db.exec(`insert into "User"(id,name,email,"passwordHash",postcode,"postcodeDistrict") values ('u1','U','u1@t.example','x','SA1 1AA','SA1')`);
    const add = (id: string, status: string) =>
      db.query(`insert into "StudentVerification"(id,"userId",status,"proofType","proofBytes","purgeAt") values ($1,'u1',$2::"StudentStatus",'image/png',1,now())`, [id, status]);
    await add("a", "PENDING");
    await expect(add("b", "PENDING")).rejects.toThrow(/StudentVerification_one_pending/);
    await add("c", "REJECTED");
    await add("d", "EXPIRED");
    expect((await db.query<{ n: number }>(`select count(*)::int n from "StudentVerification"`)).rows[0]!.n).toBe(3);
    await db.close();
  });
});

describe("13_hide_full_address", () => {
  it("gives existing listings false and adds nothing else", async () => {
    const db = await prodLikeDb();
    for (const m of ["1_v2_schema", "2_photo_variants", "3_admin_auth", "4_request_contacts", "5_subcategory_order", "6_member_accounts", "7_business_email_visibility"]) await db.exec(sql(m));
    await db.exec(`insert into "CoverageZone"(id,name,slug,"postcodeDistricts") values ('z1','Zone','zone-1',ARRAY['SA1'])`);
    const insert = (id: string, address: string | null) =>
      db.query(
        `insert into "Business"(id,slug,name,"categoryId",description,phone,postcode,"postcodeDistrict","zoneId",address) values ($1,$1,'B','c1','d','1','SA1 4PE','SA1','z1',$2)`,
        [id, address]
      );
    await insert("street", "1 High Street");
    await insert("home", "HomeBased");
    const before = await columns(db);

    await db.exec(sql("13_hide_full_address"));

    const rows = (await db.query<{ id: string; h: boolean }>(`select id, "hideFullAddress" h from "Business" order by id`)).rows;
    expect(Object.fromEntries(rows.map((r) => [r.id, r.h]))).toEqual({ street: false, home: false });
    await insert("fresh", "2 Low Road");
    expect((await db.query<{ h: boolean }>(`select "hideFullAddress" h from "Business" where id='fresh'`)).rows[0]!.h).toBe(false);
    expect((await db.query<{ a: string }>(`select address a from "Business" where id='street'`)).rows[0]!.a).toBe("1 High Street");
    const added = (await columns(db)).filter((l) => !before.includes(l));
    expect(added).toEqual(["Business|hideFullAddress|boolean|bool|NO|false"]);
    await db.close();
  });
});
