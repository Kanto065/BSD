import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { areaLabel, hidesAddress, publicEmail, publicWhere } from "../../common/public.js";
import { rolesFrom } from "../../plugins/auth.js";
import { audit, invalid } from "./admin.service.js";

// M7 print export, mounted at /admin/export. ADMIN and above download every APPROVED listing for the printed guide.
// The privacy rules are the public ones: a listing that hides its address never gets its street or full postcode here
// (only the area label), and the email is exported only when the owner ticked showEmail.

export const EXPORT_COLUMNS = [
  "Zone", "Category", "Subcategory", "Name", "Area", "Address", "Postcode", "Description", "Services", "Phone", "WhatsApp",
  "Email", "Website or social", "Opening hours", "Verification",
] as const;

type Row = Record<(typeof EXPORT_COLUMNS)[number], string>;

/** Quotes every field. A cell that starts with = + - @ (or a tab or CR) gets a leading apostrophe so Excel never runs it as a formula. */
export function csvCell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(rows: Row[]): string {
  const lines = [EXPORT_COLUMNS.map(csvCell).join(",")];
  for (const r of rows) lines.push(EXPORT_COLUMNS.map((c) => csvCell(r[c])).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n"; // BOM so Excel reads UTF-8
}

const exportRoutes: FastifyPluginAsync = async (app) => {
  const admin = { preHandler: app.requireRole(...rolesFrom("ADMIN")), config: { rateLimit: { max: 6, timeWindow: "1 minute" } } };

  app.get("/listings", admin, async (req, reply) => {
    const q = z.object({ format: z.enum(["csv", "json"]).default("csv") }).safeParse(req.query);
    if (!q.success) return invalid(reply, q.error);

    // ponytail: built in memory, fine for a few hundred to a few thousand listings. Stream with a cursor if it ever passes ~10k.
    const found = await app.prisma.business.findMany({
      where: publicWhere(),
      select: {
        name: true, description: true, servicesOffered: true, phone: true, whatsapp: true, email: true, showEmail: true,
        websiteOrSocial: true, openingHours: true, verificationStatus: true, address: true, postcode: true, postcodeDistrict: true,
        hideFullAddress: true,
        category: { select: { name: true } },
        subcategory: { select: { name: true } },
        zone: { select: { name: true } },
        localities: { select: { locality: { select: { name: true } } } },
      },
    });
    const cmp = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base" });
    const rows: Row[] = found
      .map((b) => {
        const hidden = hidesAddress(b);
        return {
          Zone: b.zone.name,
          Category: b.category.name,
          Subcategory: b.subcategory?.name ?? "",
          Name: b.name,
          Area: areaLabel(b),
          Address: hidden ? "" : (b.address ?? ""),
          Postcode: hidden ? "" : b.postcode,
          Description: b.description,
          Services: b.servicesOffered.join("; "),
          Phone: b.phone,
          WhatsApp: b.whatsapp ?? "",
          Email: publicEmail(b) ?? "",
          "Website or social": b.websiteOrSocial ?? "",
          "Opening hours": b.openingHours ?? "",
          Verification: b.verificationStatus,
        };
      })
      .sort((a, b) => cmp(a.Zone, b.Zone) || cmp(a.Category, b.Category) || cmp(a.Subcategory, b.Subcategory) || cmp(a.Name, b.Name));

    await audit(app.prisma, req.admin!.id, "export.listings", "Export", "listings", { format: q.data.format, count: rows.length });

    const stamp = new Date().toISOString().slice(0, 10);
    reply.header("Content-Disposition", `attachment; filename="bsd-print-export-${stamp}.${q.data.format}"`);
    if (q.data.format === "csv") return reply.type("text/csv; charset=utf-8").send(toCsv(rows));

    // JSON is grouped zone, then category, then the sorted listings.
    const zones: { zone: string; categories: { category: string; listings: Omit<Row, "Zone" | "Category">[] }[] }[] = [];
    for (const { Zone, Category, ...rest } of rows) {
      let z = zones.at(-1);
      if (z?.zone !== Zone) zones.push((z = { zone: Zone, categories: [] }));
      let c = z.categories.at(-1);
      if (c?.category !== Category) z.categories.push((c = { category: Category, listings: [] }));
      c.listings.push(rest);
    }
    return { generatedAt: new Date().toISOString(), total: rows.length, zones };
  });
};

export default exportRoutes;
