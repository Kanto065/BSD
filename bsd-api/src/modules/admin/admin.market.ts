import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { rolesFrom } from "../../plugins/auth.js";
import { sanitizeText } from "../../common/sanitize.js";
import { LISTING_DAYS } from "../market/market.listings.js";
import { audit, idParams, invalid, page, pageQuery } from "./admin.service.js";

// M12-B admin side, mounted at /admin/market. Moderators and above. Every change is audited. Admins see the full
// postcode and the owner, the public never does.

const DAY = 24 * 60 * 60_000;
const reason = z.string().trim().min(3, "Give a reason the member can read.").max(300);
const spotBody = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().min(2).max(200),
  postcodeDistrict: z.string().trim().toUpperCase().regex(/^[A-Z]{1,2}\d[A-Z\d]?$/, "Enter a postcode district such as SA1."),
  active: z.boolean().optional(),
}).strict();

const adminMarketRoutes: FastifyPluginAsync = async (app) => {
  const moderator = { preHandler: app.requireRole(...rolesFrom("MODERATOR")) };
  app.addHook("onSend", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
  });
  const notFound = (reply: { code: (n: number) => { send: (b: object) => unknown } }) => reply.code(404).send({ error: "Not found" });

  // ---- listings queue ----

  app.get("/counts", moderator, async () => {
    const [pending, reported, openTickets] = await Promise.all([
      app.prisma.marketListing.count({ where: { status: "PENDING" } }),
      app.prisma.marketListing.count({ where: { reportCount: { gt: 0 }, status: { not: "REMOVED" } } }),
      app.prisma.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    ]);
    return { pending, reported, openTickets };
  });

  app.get("/queue", moderator, async (req, reply) => {
    const q = pageQuery.extend({ filter: z.enum(["pending", "reported", "all"]).default("all") }).safeParse(req.query);
    if (!q.success) return invalid(reply, q.error);
    const where: Prisma.MarketListingWhereInput =
      q.data.filter === "pending" ? { status: "PENDING" }
      : q.data.filter === "reported" ? { reportCount: { gt: 0 }, status: { not: "REMOVED" } }
      : { OR: [{ status: "PENDING" }, { reportCount: { gt: 0 }, status: { not: "REMOVED" } }] };
    const [total, items] = await app.prisma.$transaction([
      app.prisma.marketListing.count({ where }),
      app.prisma.marketListing.findMany({
        where, orderBy: { createdAt: "asc" }, ...page(q.data),
        select: {
          id: true, slug: true, title: true, description: true, kind: true, status: true, pricePence: true, postcode: true, postcodeDistrict: true,
          hideFullAddress: true, reportCount: true, createdAt: true, removalReason: true,
          category: { select: { name: true } },
          owner: { select: { id: true, name: true, email: true } },
          reports: { orderBy: { createdAt: "asc" }, select: { reason: true, note: true, createdAt: true } },
        },
      }),
    ]);
    return { items, total, page: q.data.page, pageSize: q.data.pageSize };
  });

  // Approve clears the reports so the same three people cannot hide it again with the old reports.
  const decide = (name: string, from: Prisma.MarketListingWhereInput["status"], act: string, body: z.ZodTypeAny | null, data: (b: any, l: { expiresAt: Date }) => Prisma.MarketListingUpdateInput, clearReports = false) =>
    app.post(`/listings/:id/${name}`, moderator, async (req, reply) => {
      const p = idParams.safeParse(req.params);
      const b = body ? body.safeParse(req.body) : null;
      if (!p.success) return notFound(reply);
      if (b && !b.success) return invalid(reply, b.error);
      const l = await app.prisma.marketListing.findFirst({ where: { id: p.data.id, status: from }, select: { id: true, status: true, expiresAt: true } });
      if (!l) return notFound(reply);
      await app.prisma.$transaction([
        app.prisma.marketListing.update({ where: { id: l.id }, data: data(b?.data, l) }),
        ...(clearReports ? [app.prisma.marketReport.deleteMany({ where: { listingId: l.id } })] : []),
        audit(app.prisma, req.admin!.id, act, "MarketListing", l.id, { from: l.status, ...(b ? { reason: b.data.reason } : {}) }),
      ]);
      return { ok: true };
    });
  const reasonBody = z.object({ reason }).strict();
  decide("approve", "PENDING", "MARKET_APPROVE", null, () => ({ status: "ACTIVE", reportCount: 0, removalReason: null, closedAt: null }), true);
  decide("remove", { in: ["PENDING", "ACTIVE", "RESERVED", "SOLD", "ARCHIVED"] }, "MARKET_REMOVE", reasonBody,
    (b) => ({ status: "REMOVED", removalReason: sanitizeText(b.reason), closedAt: new Date() }));
  decide("restore", "REMOVED", "MARKET_RESTORE", null, (_b, l) => ({
    status: "ACTIVE", removalReason: null, closedAt: null, reportCount: 0,
    ...(l.expiresAt.getTime() < Date.now() ? { expiresAt: new Date(Date.now() + LISTING_DAYS * DAY) } : {}),
  }), true);

  // Take down everything one member has listed, for example after a scam. Keeps the listings for the record.
  app.post("/users/:id/remove-listings", moderator, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    const b = reasonBody.safeParse(req.body);
    if (!p.success || !(await app.prisma.user.findUnique({ where: { id: p.data.id }, select: { id: true } }))) return notFound(reply);
    if (!b.success) return invalid(reply, b.error);
    const [res] = await app.prisma.$transaction([
      app.prisma.marketListing.updateMany({ where: { ownerUserId: p.data.id, status: { not: "REMOVED" } }, data: { status: "REMOVED", removalReason: sanitizeText(b.data.reason), closedAt: new Date() } }),
      audit(app.prisma, req.admin!.id, "MARKET_REMOVE_USER_LISTINGS", "User", p.data.id, { reason: b.data.reason }),
    ]);
    return { ok: true, removed: res.count };
  });

  // ---- tickets ----

  app.get("/tickets", moderator, async (req, reply) => {
    const q = pageQuery.extend({ status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional() }).safeParse(req.query);
    if (!q.success) return invalid(reply, q.error);
    const where = q.data.status ? { status: q.data.status } : {};
    const [total, items] = await app.prisma.$transaction([
      app.prisma.supportTicket.count({ where }),
      app.prisma.supportTicket.findMany({
        where, orderBy: { createdAt: "asc" }, ...page(q.data),
        select: { id: true, number: true, category: true, message: true, status: true, adminReply: true, createdAt: true, updatedAt: true, listing: { select: { id: true, slug: true, title: true } }, user: { select: { id: true, name: true, email: true } } },
      }),
    ]);
    return { items, total, page: q.data.page, pageSize: q.data.pageSize };
  });

  const ticketPatch = z.object({ adminReply: z.string().trim().min(1).max(2000).optional(), status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional() })
    .strict().refine((v) => v.adminReply !== undefined || v.status !== undefined, { message: "Send a reply or a status." });
  app.patch("/tickets/:id", moderator, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    const b = ticketPatch.safeParse(req.body);
    if (!p.success) return notFound(reply);
    if (!b.success) return invalid(reply, b.error);
    const t = await app.prisma.supportTicket.findUnique({ where: { id: p.data.id }, select: { id: true, status: true } });
    if (!t) return notFound(reply);
    const status = b.data.status ?? (b.data.adminReply !== undefined && t.status === "OPEN" ? "IN_PROGRESS" : undefined);
    const [updated] = await app.prisma.$transaction([
      app.prisma.supportTicket.update({
        where: { id: t.id },
        data: { ...(b.data.adminReply !== undefined ? { adminReply: sanitizeText(b.data.adminReply) } : {}), ...(status ? { status } : {}) },
        select: { id: true, number: true, status: true, adminReply: true },
      }),
      audit(app.prisma, req.admin!.id, "TICKET_UPDATE", "SupportTicket", t.id, { from: t.status, to: status ?? t.status, replied: b.data.adminReply !== undefined }),
    ]);
    return { ok: true, ticket: updated };
  });

  // ---- safe spots ----

  app.get("/spots", moderator, async () => ({ spots: await app.prisma.safeSpot.findMany({ orderBy: { name: "asc" } }) }));

  app.post("/spots", moderator, async (req, reply) => {
    const b = spotBody.safeParse(req.body);
    if (!b.success) return invalid(reply, b.error);
    const spot = await app.prisma.safeSpot.create({ data: { ...b.data, name: sanitizeText(b.data.name), address: sanitizeText(b.data.address) } });
    await audit(app.prisma, req.admin!.id, "SPOT_CREATE", "SafeSpot", spot.id, { name: spot.name });
    return reply.code(201).send({ ok: true, spot });
  });

  app.patch("/spots/:id", moderator, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    const b = spotBody.partial().safeParse(req.body);
    if (!p.success || !(await app.prisma.safeSpot.findUnique({ where: { id: p.data.id }, select: { id: true } }))) return notFound(reply);
    if (!b.success) return invalid(reply, b.error);
    const data = { ...b.data, ...(b.data.name ? { name: sanitizeText(b.data.name) } : {}), ...(b.data.address ? { address: sanitizeText(b.data.address) } : {}) };
    const [spot] = await app.prisma.$transaction([
      app.prisma.safeSpot.update({ where: { id: p.data.id }, data }),
      audit(app.prisma, req.admin!.id, "SPOT_UPDATE", "SafeSpot", p.data.id, data),
    ]);
    return { ok: true, spot };
  });

  // Listings that used the spot keep working: the relation sets spotId to null.
  app.delete("/spots/:id", moderator, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success || !(await app.prisma.safeSpot.findUnique({ where: { id: p.data.id }, select: { id: true } }))) return notFound(reply);
    await app.prisma.$transaction([app.prisma.safeSpot.delete({ where: { id: p.data.id } }), audit(app.prisma, req.admin!.id, "SPOT_DELETE", "SafeSpot", p.data.id)]);
    return { ok: true };
  });

  // ---- categories ----

  app.get("/categories", moderator, async () => ({ categories: await app.prisma.marketCategory.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, slug: true, staged: true } }) }));

  app.patch("/categories/:id", moderator, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    const b = z.object({ staged: z.boolean() }).strict().safeParse(req.body);
    if (!p.success || !(await app.prisma.marketCategory.findUnique({ where: { id: p.data.id }, select: { id: true } }))) return notFound(reply);
    if (!b.success) return invalid(reply, b.error);
    const [category] = await app.prisma.$transaction([
      app.prisma.marketCategory.update({ where: { id: p.data.id }, data: { staged: b.data.staged }, select: { id: true, name: true, slug: true, staged: true } }),
      audit(app.prisma, req.admin!.id, "MARKET_CATEGORY_STAGED", "MarketCategory", p.data.id, { staged: b.data.staged }),
    ]);
    return { ok: true, category };
  });
};

export default adminMarketRoutes;
