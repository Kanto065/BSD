import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { rolesFrom } from "../../plugins/auth.js";
import { audit, idParams, invalid, page, pageQuery } from "./admin.service.js";

// M11-B admin side, mounted at /admin/offers. Moderators and above approve or reject a merchant's offer. Every
// decision is audited in the same transaction. Only a PENDING offer can be decided, so two moderators cannot both win.

const rejectBody = z.object({ reason: z.string().trim().min(5, "Give a reason of at least 5 characters.").max(300, "Keep the reason to 300 characters.") });
const statusQuery = pageQuery.extend({ status: z.enum(["PENDING", "ACTIVE", "PAUSED", "REJECTED"]).optional() });

const offersAdminRoutes: FastifyPluginAsync = async (app) => {
  const moderator = { preHandler: app.requireRole(...rolesFrom("MODERATOR")) };
  app.addHook("onSend", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
  });

  app.get("/", moderator, async (req, reply) => {
    const q = statusQuery.safeParse(req.query);
    if (!q.success) return invalid(reply, q.error);
    const where = q.data.status ? { status: q.data.status } : {};
    const [total, rows] = await app.prisma.$transaction([
      app.prisma.privilegeOffer.count({ where }),
      app.prisma.privilegeOffer.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        ...page(q.data),
        select: {
          id: true, title: true, percent: true, terms: true, status: true, rejectionReason: true, decidedAt: true, createdAt: true, updatedAt: true,
          business: { select: { id: true, name: true, slug: true, status: true } },
        },
      }),
    ]);
    const items = rows.map((o) => ({ ...o, percent: o.percent === null ? null : Number(o.percent) }));
    return { items, total, page: q.data.page, pageSize: q.data.pageSize };
  });

  const decide = (name: "approve" | "reject") =>
    app.post(`/:id/${name}`, moderator, async (req, reply) => {
      const p = idParams.safeParse(req.params);
      if (!p.success) return reply.code(404).send({ error: "Not found" });
      let reason: string | null = null;
      if (name === "reject") {
        const b = rejectBody.safeParse(req.body);
        if (!b.success) return invalid(reply, b.error);
        reason = b.data.reason;
      }
      const adminId = req.admin!.id;
      const result = await app.prisma.$transaction(async (tx) => {
        const offer = await tx.privilegeOffer.findUnique({ where: { id: p.data.id }, select: { id: true } });
        if (!offer) return "missing" as const;
        const { count } = await tx.privilegeOffer.updateMany({
          where: { id: offer.id, status: "PENDING" },
          data: { status: name === "approve" ? "ACTIVE" : "REJECTED", decidedAt: new Date(), decidedById: adminId, rejectionReason: reason },
        });
        if (!count) return "decided" as const;
        await audit(tx, adminId, name === "approve" ? "OFFER_APPROVE" : "OFFER_REJECT", "PrivilegeOffer", offer.id, reason ? { reason } : undefined);
        return "ok" as const;
      });
      if (result === "missing") return reply.code(404).send({ error: "Not found" });
      if (result === "decided") return reply.code(409).send({ error: "This offer has already been decided." });
      return { ok: true };
    });
  decide("approve");
  decide("reject");
};

export default offersAdminRoutes;
