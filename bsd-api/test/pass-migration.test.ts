import { describe, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

vi.setConfig({ testTimeout: 90_000 });

const MIGRATIONS = path.resolve(__dirname, "../prisma/migrations");
const sql = (name: string) => fs.readFileSync(path.join(MIGRATIONS, name, "migration.sql"), "utf8");

describe("18_privilege_pass", () => {
  it("adds the pass tables without touching existing rows, enforces uniqueness and cascades", async () => {
    const db = new PGlite();
    const folders = fs.readdirSync(MIGRATIONS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    for (const f of folders.slice(0, folders.indexOf("18_privilege_pass"))) await db.exec(sql(f));
    await db.exec(`insert into "CoverageZone"(id,name,slug,"postcodeDistricts") values ('z1','Zone','zone-1',ARRAY['SA1'])`);
    await db.exec(`insert into "Category"(id,name,slug) values ('c1','Cat','cat')`);
    await db.exec(`insert into "User"(id,name,email,"passwordHash",postcode,"postcodeDistrict") values ('u1','U','u1@t.example','x','SA1 1AA','SA1')`);
    await db.exec(`insert into "Business"(id,slug,name,"categoryId",description,phone,postcode,"postcodeDistrict","zoneId") values ('b1','b1','B','c1','d','1','SA1 1AA','SA1','z1')`);

    await db.exec(sql("18_privilege_pass"));

    expect((await db.query(`select count(*)::int n from "User"`)).rows[0]).toEqual({ n: 1 });
    await db.exec(`insert into "PrivilegeCard"(id,"userId","cardNumber",secret) values ('k1','u1','BC-2026-123456','s')`);
    const card = (await db.query<Record<string, unknown>>(`select level,status,"deviceMoves","deviceHash" from "PrivilegeCard"`)).rows[0];
    expect(card).toEqual({ level: 1, status: "ACTIVE", deviceMoves: 0, deviceHash: null });
    await expect(db.exec(`insert into "PrivilegeCard"(id,"userId","cardNumber",secret) values ('k2','u1','BC-2026-999999','s')`)).rejects.toThrow(/userId_key/);
    await db.exec(`insert into "PrivilegeOffer"(id,"businessId",title,terms,"updatedAt") values ('o1','b1','10 off','Show your pass',now())`);
    expect((await db.query<{ status: string }>(`select status from "PrivilegeOffer"`)).rows[0]!.status).toBe("PENDING");
    await expect(db.exec(`insert into "PrivilegeOffer"(id,"businessId",title,terms,"updatedAt") values ('o2','b1','x','yyyyy',now())`)).rejects.toThrow(/businessId_key/);
    await db.exec(`insert into "PrivilegeCode"(id,"cardId","offerId",code,"expiresAt") values ('c1','k1','o1','BC-1234-SA1',now())`);
    await expect(db.exec(`insert into "PrivilegeCode"(id,"cardId","offerId",code,"expiresAt") values ('c2','k1','o1','BC-1234-SA1',now())`)).rejects.toThrow(/offerId_code_key/);
    await db.exec(`insert into "PrivilegeRedemption"(id,"cardId","offerId","businessId","scannedByUserId",method) values ('r1','k1','o1','b1','u1','QR')`);

    // deleting the member removes the card and everything hanging off it
    await db.exec(`delete from "User" where id='u1'`);
    for (const t of ["PrivilegeCard", "PrivilegeCode", "PrivilegeRedemption"]) {
      expect((await db.query<{ n: number }>(`select count(*)::int n from "${t}"`)).rows[0]!.n).toBe(0);
    }
    await db.close();
  });
});
