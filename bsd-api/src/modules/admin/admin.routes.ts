import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { rolesFrom } from "../../plugins/auth.js";
import { sanitizeText } from "../../common/sanitize.js";
import authRoutes from "./admin.auth.js";
import listingsRoutes from "./admin.listings.js";
import usersRoutes from "./admin.users.js";
import categoriesAdminRoutes from "./admin.categories.js";
import requestsAdminRoutes from "./admin.requests.js";
import { audit, idParams, invalid, page, pageQuery, statusCounts } from "./admin.service.js";

// The admin API. Who can do what:
//   VOLUNTEER    the verification queue, and setting a listing's verification status
//   MODERATOR    also: listings (approve, reject, edit, remove), claims, update and removal requests, messages
//   ADMIN        also: the audit log, categories and subcategories
//   SUPER_ADMIN  also: team accounts
// The admin web pages only show what a role can use. These checks are the real boundary.

const adminRoutes: FastifyPluginAsync = async (app) => {
  // Admin responses are never cached anywhere.
  app.addHook("onSend", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
  });

  app.register(authRoutes);
  app.register(listingsRoutes);
  app.register(usersRoutes);
  app.register(categoriesAdminRoutes);
  app.register(requestsAdminRoutes);

  const anyAdmin = { preHandler: app.requireRole() };
  const moderator = { preHandler: app.requireRole(...rolesFrom("MODERATOR")) };
  const admin = { preHandler: app.requireRole(...rolesFrom("ADMIN")) };

  app.get("/dashboard", anyAdmin, async () => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [verificationQueue, approvedThisWeek, pendingClaims, openMessages, pendingUpdates, pendingRemovals, emergencyRemovals] = await app.prisma.$transaction([
      app.prisma.business.count({ where: { status: "APPROVED", verificationStatus: { not: "COMMUNITY_VERIFIED" } } }),
      app.prisma.business.count({ where: { status: "APPROVED", reviewedAt: { gte: weekAgo } } }),
      app.prisma.listingClaimRequest.count({ where: { status: "PENDING" } }),
      app.prisma.contactMessage.count({ where: { status: "OPEN" } }),
      app.prisma.listingUpdateRequest.count({ where: { status: "PENDING" } }),
      app.prisma.listingRemovalRequest.count({ where: { status: "PENDING" } }),
      app.prisma.listingRemovalRequest.count({ where: { status: "PENDING", isEmergency: true } }),
    ]);
    return {
      listings: await statusCounts(app.prisma),
      approvedThisWeek,
      verificationQueue,
      pendingClaims,
      openMessages,
      pendingUpdates,
      pendingRemovals,
      emergencyRemovals,
    };
  });

  // --- claims ("Claim This Listing" requests; the public form arrives in M6) ---------------------------------

  app.get("/claims", moderator, async (req, reply) => {
    const q = pageQuery.extend({ status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING") }).safeParse(req.query);
    if (!q.success) return invalid(reply, q.error);
    const where = { status: q.data.status };
    const [total, items] = await app.prisma.$transaction([
      app.prisma.listingClaimRequest.count({ where }),
      app.prisma.listingClaimRequest.findMany({
        where,
        orderBy: { createdAt: "asc" },
        ...page(q.data),
        include: { business: { select: { id: true, name: true, slug: true, status: true } }, reviewedBy: { select: { name: true } } },
      }),
    ]);
    return { items, total, page: q.data.page, pageSize: q.data.pageSize };
  });

  for (const decision of ["approve", "reject"] as const) {
    app.patch(`/claims/:id/${decision}`, moderator, async (req, reply) => {
      const p = idParams.safeParse(req.params);
      if (!p.success) return reply.code(404).send({ error: "Not found" });
      const note = z.object({ note: z.string().trim().max(500).optional() }).optional().safeParse(req.body ?? undefined);
      if (!note.success) return invalid(reply, note.error);
      const claim = await app.prisma.listingClaimRequest.findUnique({ where: { id: p.data.id } });
      if (!claim) return reply.code(404).send({ error: "Not found" });
      if (claim.status !== "PENDING") return reply.code(409).send({ error: "This claim has already been decided." });
      const status = decision === "approve" ? "APPROVED" : "REJECTED";
      await app.prisma.$transaction([
        app.prisma.listingClaimRequest.update({ where: { id: claim.id }, data: { status, reviewedAt: new Date(), reviewedById: req.admin!.id } }),
        audit(app.prisma, req.admin!.id, `${decision.toUpperCase()}_CLAIM`, "ListingClaimRequest", claim.id, {
          businessId: claim.businessId,
          ...(note.data?.note ? { note: sanitizeText(note.data.note) } : {}),
        }),
      ]);
      return { ok: true, status };
    });
  }

  // --- contact messages (the public contact form arrives later; this reads what is there) --------------------

  app.get("/messages", moderator, async (req, reply) => {
    const q = pageQuery
      .extend({ status: z.enum(["OPEN", "RESOLVED"]).default("OPEN"), type: z.enum(["SUPPORT", "COMPLIANCE", "COMMUNITY", "ADMIN"]).optional() })
      .safeParse(req.query);
    if (!q.success) return invalid(reply, q.error);
    const where: Prisma.ContactMessageWhereInput = { status: q.data.status, ...(q.data.type ? { type: q.data.type } : {}) };
    const [total, items] = await app.prisma.$transaction([
      app.prisma.contactMessage.count({ where }),
      app.prisma.contactMessage.findMany({ where, orderBy: { createdAt: "asc" }, ...page(q.data) }),
    ]);
    return { items, total, page: q.data.page, pageSize: q.data.pageSize };
  });

  app.patch("/messages/:id/resolve", moderator, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const found = await app.prisma.contactMessage.findUnique({ where: { id: p.data.id } });
    if (!found) return reply.code(404).send({ error: "Not found" });
    await app.prisma.$transaction([
      app.prisma.contactMessage.update({ where: { id: found.id }, data: { status: "RESOLVED" } }),
      audit(app.prisma, req.admin!.id, "RESOLVE_MESSAGE", "ContactMessage", found.id),
    ]);
    return { ok: true };
  });

  // --- audit log ------------------------------------------------------------------------------------------------

  app.get("/audit-log", admin, async (req, reply) => {
    const q = pageQuery
      .extend({ entityId: z.string().max(64).optional(), adminId: z.string().max(64).optional(), action: z.string().max(40).optional() })
      .safeParse(req.query);
    if (!q.success) return invalid(reply, q.error);
    const where: Prisma.AuditLogWhereInput = {
      ...(q.data.entityId ? { entityId: q.data.entityId } : {}),
      ...(q.data.adminId ? { adminId: q.data.adminId } : {}),
      ...(q.data.action ? { action: q.data.action } : {}),
    };
    const [total, items] = await app.prisma.$transaction([
      app.prisma.auditLog.count({ where }),
      app.prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, ...page(q.data), include: { admin: { select: { name: true, email: true } } } }),
    ]);
    return { items, total, page: q.data.page, pageSize: q.data.pageSize };
  });
};

export default adminRoutes;
