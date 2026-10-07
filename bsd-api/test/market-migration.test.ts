import { describe, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

// 19_marketplace on top of 0 to 15 (16, 17 and 18 belong to parallel branches and touch other tables).

vi.setConfig({ testTimeout: 90_000 });
const MIGRATIONS = path.resolve(__dirname, "../prisma/migrations");
const sql = (name: string) => fs.readFileSync(path.join(MIGRATIONS, name, "migration.sql"), "utf8");

describe("19_marketplace", () => {
  it("applies after the earlier migrations, seeds 11 categories, keeps Housing and Jobs staged, and numbers tickets from a sequence", async () => {
    const db = new PGlite();
    const folders = fs
      .readdirSync(MIGRATIONS, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((n) => parseInt(n, 10) <= 15 || n === "19_marketplace")
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    expect(folders.at(-1)).toBe("19_marketplace");
    for (const f of folders) await db.exec(sql(f));

    const cats = await db.query<{ name: string; staged: boolean }>(`select name, staged from "MarketCategory" order by "sortOrder"`);
    expect(cats.rows).toHaveLength(11);
    expect(cats.rows.filter((c) => c.staged).map((c) => c.name)).toEqual(["Housing & Accommodation", "Jobs & Opportunities"]);

    const seq = await db.query<{ n: string }>(`select nextval('support_ticket_seq')::text as n`);
    expect(seq.rows[0]!.n).toBe("1");

    const tables = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema='public' and table_name in ('MarketListing','MarketImage','MarketSave','MarketReport','SupportTicket','SafeSpot','MarketCategory')`
    );
    expect(tables.rows).toHaveLength(7);

    // One report per person per listing.
    await db.exec(`insert into "User"(id,name,email,"passwordHash",postcode,"postcodeDistrict") values ('u1','n','e@x.test','x','SA1 1AA','SA1')`);
    await db.exec(
      `insert into "MarketListing"(id,slug,"ownerUserId",kind,title,description,"categoryId",postcode,"postcodeDistrict",whatsapp,"expiresAt") values ('l1','s','u1','SELL','t','d','mcat-vehicles','SA1 1AA','SA1','0770','2030-01-01')`
    );
    await db.exec(`insert into "MarketReport"(id,"listingId","reporterUserId",reason) values ('r1','l1','u1','spam')`);
    await expect(db.exec(`insert into "MarketReport"(id,"listingId","reporterUserId",reason) values ('r2','l1','u1','spam')`)).rejects.toThrow();
  });
});
