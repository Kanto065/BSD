import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { rolesFrom } from "../../plugins/auth.js";
import { sanitizeText } from "../../common/sanitize.js";
import { audit, idParams, invalid, page, pageQuery } from "./admin.service.js";

// Update and removal requests from listing pages (MODERATOR and above). Targets from the FAQ and Privacy Policy:
// updates and removals within 3-7 working days, emergency removals within 24 hours. Emergencies are listed first,
// then oldest first, so nothing silently ages past its target.

const decideUpdate = z.object({ status: z.enum(["APPLIED", "REJECTED"]), note: z.string().trim().max(500).optional() }).strict();
const decideRemoval = z.object({ status: z.enum(["REMOVED", "REJECTED"]), note: z.string().trim().max(500).optional() }).strict();

const listing = { select: { id: true, name: true, slug: true, status: true } } as const;

const requestsAdminRoutes: FastifyPluginAsync = async (app) => {
  const moderator = { preHandler: app.requireRole(...rolesFrom("MODERATOR")) };

  app.get("/update-requests", moderator, async (req, reply) => {
    const q = pageQuery.extend({ status: z.enum(["PENDING", "APPLIED", "REJECTED"]).default("PENDING") }).safeParse(req.query);
    if (!q.success) return invalid(reply, q.error);
    const where = { status: q.data.status };
    const [total, items] = await app.prisma.$transaction([
      app.prisma.listingUpdateRequest.count({ where }),
      app.prisma.listingUpdateRequest.findMany({
        where,
        orderBy: { requestedAt: "asc" },
        ...page(q.data),
        include: { business: listing, reviewedBy: { select: { name: true } } },
      }),
    ]);
    return { items, total, page: q.data.page, pageSize: q.data.pageSize };
  });

  app.patch("/update-requests/:id", moderator, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const body = decideUpdate.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    const r = await app.prisma.listingUpdateRequest.findUnique({ where: { id: p.data.id } });
    if (!r) return reply.code(404).send({ error: "Not found" });
    if (r.status !== "PENDING") return reply.code(409).send({ error: "This request has already been handled." });
    const note = body.data.note ? sanitizeText(body.data.note) : null;
    await app.prisma.$transaction([
      app.prisma.listingUpdateRequest.update({
        where: { id: r.id },
        data: { status: body.data.status, reviewNote: note, reviewedAt: new Date(), reviewedById: req.admin!.id },
      }),
      audit(app.prisma, req.admin!.id, `UPDATE_REQUEST_${body.data.status}`, "Business", r.businessId, { requestId: r.id, ...(note ? { note } : {}) }),
    ]);
    return { ok: true };
  });

  app.get("/removal-requests", moderator, async (req, reply) => {
    const q = pageQuery.extend({ status: z.enum(["PENDING", "REMOVED", "REJECTED"]).default("PENDING") }).safeParse(req.query);
    if (!q.success) return invalid(reply, q.error);
    const where = { status: q.data.status };
    const [total, items] = await app.prisma.$transaction([
      app.prisma.listingRemovalRequest.count({ where }),
      app.prisma.listingRemovalRequest.findMany({
        where,
        orderBy: [{ isEmergency: "desc" }, { requestedAt: "asc" }],
        ...page(q.data),
        include: { business: listing, reviewedBy: { select: { name: true } } },
      }),
    ]);
    return { items, total, page: q.data.page, pageSize: q.data.pageSize };
  });

  // Accepting a removal request removes the listing (soft remove, as everywhere else) in the same transaction.
  app.patch("/removal-requests/:id", moderator, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const body = decideRemoval.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    const r = await app.prisma.listingRemovalRequest.findUnique({ where: { id: p.data.id }, include: { business: { select: { status: true } } } });
    if (!r) return reply.code(404).send({ error: "Not found" });
    if (r.status !== "PENDING") return reply.code(409).send({ error: "This request has already been handled." });
    const note = body.data.note ? sanitizeText(body.data.note) : null;
    const now = new Date();
    await app.prisma.$transaction([
      app.prisma.listingRemovalRequest.update({
        where: { id: r.id },
        data: { status: body.data.status, reviewNote: note, reviewedAt: now, reviewedById: req.admin!.id },
      }),
      ...(body.data.status === "REMOVED"
        ? [
            app.prisma.business.update({ where: { id: r.businessId }, data: { status: "REMOVED", reviewedAt: now, reviewedById: req.admin!.id } }),
            audit(app.prisma, req.admin!.id, "REMOVE_LISTING", "Business", r.businessId, { from: r.business.status, reason: "removal request", requestId: r.id }),
          ]
        : [audit(app.prisma, req.admin!.id, "REMOVAL_REQUEST_REJECTED", "Business", r.businessId, { requestId: r.id, ...(note ? { note } : {}) })]),
    ]);
    return { ok: true };
  });
};

export default requestsAdminRoutes;
