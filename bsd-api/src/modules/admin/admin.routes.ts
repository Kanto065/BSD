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
import siteAdminRoutes from "./admin.site.js";
import studentsAdminRoutes from "./admin.students.js";
import synonymsAdminRoutes from "./admin.synonyms.js";
import { audit, idParams, invalid, page, pageQuery, statusCounts } from "./admin.service.js";

class OwnerConflict extends Error {}

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
  app.register(siteAdminRoutes);
  app.register(studentsAdminRoutes, { prefix: "/students" });
  app.register(synonymsAdminRoutes);

  const anyAdmin = { preHandler: app.requireRole() };
  const moderator = { preHandler: app.requireRole(...rolesFrom("MODERATOR")) };
  const admin = { preHandler: app.requireRole(...rolesFrom("ADMIN")) };

  app.get("/dashboard", anyAdmin, async () => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [verificationQueue, approvedThisWeek, pendingClaims, openMessages, pendingUpdates, pendingRemovals, emergencyRemovals, pendingStudents] = await app.prisma.$transaction([
      app.prisma.business.count({ where: { status: "APPROVED", verificationStatus: { not: "COMMUNITY_VERIFIED" } } }),
      app.prisma.business.count({ where: { status: "APPROVED", reviewedAt: { gte: weekAgo } } }),
      app.prisma.listingClaimRequest.count({ where: { status: "PENDING" } }),
      app.prisma.contactMessage.count({ where: { status: "OPEN" } }),
      app.prisma.listingUpdateRequest.count({ where: { status: "PENDING" } }),
      app.prisma.listingRemovalRequest.count({ where: { status: "PENDING" } }),
      app.prisma.listingRemovalRequest.count({ where: { status: "PENDING", isEmergency: true } }),
      app.prisma.studentVerification.count({ where: { status: "PENDING" } }),
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
      pendingStudents,
    };
  });

  // --- claims ("Claim This Listing" requests, made by signed in members since M9-D; older anonymous rows have no account) ---

  app.get("/claims", moderator, async (req, reply) => {
    const q = pageQuery.extend({ status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING") }).safeParse(req.query);
    if (!q.success) return invalid(reply, q.error);
    const where = { status: q.data.status };
    const [total, rows] = await app.prisma.$transaction([
      app.prisma.listingClaimRequest.count({ where }),
      app.prisma.listingClaimRequest.findMany({
        where,
        orderBy: { createdAt: "asc" },
        ...page(q.data),
        include: {
          business: { select: { id: true, name: true, slug: true, status: true, owner: { select: { id: true, name: true, email: true, deletedAt: true } } } },
          reviewedBy: { select: { name: true } },
          user: { select: { name: true, email: true, postcode: true, deletedAt: true } },
        },
      }),
    ]);
    // The storage key never leaves the API. A deleted member or owner is shown by name only.
    const items = rows.map(({ proofKey, user, business, ...c }) => ({
      ...c,
      hasProof: proofKey !== null,
      user: user ? { name: user.name, email: user.deletedAt ? null : user.email, postcode: user.postcode } : null,
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        status: business.status,
        owner: business.owner ? { name: business.owner.name, email: business.owner.deletedAt ? null : business.owner.email } : null,
      },
    }));
    return { items, total, page: q.data.page, pageSize: q.data.pageSize };
  });

  // The private document, streamed to moderators only. Never a URL, every view is audited.
  app.get("/claims/:id/proof", moderator, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const row = await app.prisma.listingClaimRequest.findUnique({ where: { id: p.data.id }, select: { id: true, proofKey: true, proofType: true } });
    if (!row?.proofKey || !app.storage) return reply.code(404).send({ error: "Not found" });
    const file = await app.storage.get(row.proofKey, { private: true });
    if (!file) return reply.code(404).send({ error: "Not found" });
    await audit(app.prisma, req.admin!.id, "claim.proof_viewed", "ListingClaimRequest", row.id);
    return reply
      .header("Content-Type", row.proofType ?? "application/octet-stream")
      .header("Content-Disposition", "inline")
      .header("X-Content-Type-Options", "nosniff")
      .header("Cache-Control", "no-store")
      .header("Content-Security-Policy", "sandbox")
      .send(file.body);
  });

  const DAY_MS = 24 * 60 * 60 * 1000;
  const decisionBody = z.object({
    note: z.string().trim().max(500).optional(),
    linkOwner: z.boolean().optional(),
    replaceOwner: z.boolean().optional(),
  });

  for (const decision of ["approve", "reject"] as const) {
    app.patch(`/claims/:id/${decision}`, moderator, async (req, reply) => {
      const p = idParams.safeParse(req.params);
      if (!p.success) return reply.code(404).send({ error: "Not found" });
      const body = decisionBody.safeParse(req.body ?? {});
      if (!body.success) return invalid(reply, body.error);
      const claim = await app.prisma.listingClaimRequest.findUnique({ where: { id: p.data.id } });
      if (!claim) return reply.code(404).send({ error: "Not found" });
      if (claim.status !== "PENDING") return reply.code(409).send({ error: "This claim has already been decided." });
      const note = body.data.note ? sanitizeText(body.data.note) : "";
      // The member reads the note of a refusal, so it is required there.
      if (decision === "reject" && (note.length < 5 || note.length > 300)) {
        return reply.code(400).send({ error: "Please check the highlighted fields.", fieldErrors: { note: "Enter a reason of 5 to 300 characters." } });
      }
      const linkOwner = decision === "approve" && (body.data.linkOwner ?? !!claim.userId);
      if (linkOwner && !claim.userId) {
        return reply.code(400).send({ error: "This claim has no member account to link. Untick Link this member as owner." });
      }
      const status = decision === "approve" ? "APPROVED" : "REJECTED";
      const now = new Date();
      const result = await app.prisma.$transaction(async (tx) => {
        const done = await tx.listingClaimRequest.updateMany({
          where: { id: claim.id, status: "PENDING" },
          data: {
            status,
            reviewedAt: now,
            reviewedById: req.admin!.id,
            purgeAt: new Date(now.getTime() + DAY_MS),
            linkedOwner: linkOwner,
            ...(decision === "reject" ? { decisionNote: note } : {}),
          },
        });
        if (done.count === 0) return "decided" as const;
        let owner: { from: string | null; to: string | null } | undefined;
        if (linkOwner) {
          const biz = await tx.business.findUnique({ where: { id: claim.businessId }, select: { ownerUserId: true, owner: { select: { deletedAt: true } } } });
          const current = biz?.ownerUserId ?? null;
          // A deleted member does not hold the listing, anyone else needs the explicit tick.
          if (current && current !== claim.userId && !biz?.owner?.deletedAt && !body.data.replaceOwner) throw new OwnerConflict();
          await tx.business.update({ where: { id: claim.businessId }, data: { ownerUserId: claim.userId } });
          owner = { from: current, to: claim.userId };
        }
        await audit(tx, req.admin!.id, `${decision.toUpperCase()}_CLAIM`, "ListingClaimRequest", claim.id, {
          businessId: claim.businessId,
          ...(note ? { note } : {}),
          ...(owner ? { ownerFrom: owner.from, ownerTo: owner.to } : {}),
        });
        return "ok" as const;
      }).catch((e) => (e instanceof OwnerConflict ? ("owner" as const) : Promise.reject(e)));
      if (result === "decided") return reply.code(409).send({ error: "This claim has already been decided." });
      if (result === "owner") return reply.code(409).send({ error: "This listing already has an owner. Tick Replace owner to change it." });
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
