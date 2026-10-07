import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { sanitizeText } from "../../common/sanitize.js";
import { rolesFrom } from "../../plugins/auth.js";
import { audit, idParams, invalid, page, pageQuery } from "./admin.service.js";

// R-11 admin side, mounted at /admin/students. Moderators and above, because the proofs are personal documents.
// A proof is streamed through the API only (never a URL), every view is audited, and nothing here returns the storage key.

const DAY_MS = 24 * 60 * 60 * 1000;

const studentsAdminRoutes: FastifyPluginAsync = async (app) => {
  const moderator = { preHandler: app.requireRole(...rolesFrom("MODERATOR")) };
  const admin = { preHandler: app.requireRole(...rolesFrom("ADMIN")) };

  app.get("/", moderator, async (req, reply) => {
    const q = pageQuery.extend({ status: z.enum(["PENDING", "ALL"]).default("PENDING") }).safeParse(req.query);
    if (!q.success) return invalid(reply, q.error);
    const where = q.data.status === "PENDING" ? { status: "PENDING" as const } : {};
    const [total, rows] = await app.prisma.$transaction([
      app.prisma.studentVerification.count({ where }),
      app.prisma.studentVerification.findMany({
        where,
        orderBy: { submittedAt: "asc" },
        ...page(q.data),
        select: {
          id: true, userId: true, status: true, submittedAt: true, decidedAt: true, rejectionReason: true, proofType: true, note: true, proofKey: true,
          user: { select: { name: true, email: true, postcode: true, deletedAt: true } },
        },
      }),
    ]);
    const items = rows.map(({ proofKey, user, ...r }) => ({
      ...r,
      hasProof: proofKey !== null,
      // A deleted member is shown by name only, the stored address is a placeholder.
      user: { name: user.name, email: user.deletedAt ? null : user.email, postcode: user.postcode },
    }));
    return { items, total, page: q.data.page, pageSize: q.data.pageSize };
  });

  app.get("/:id/proof", moderator, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const row = await app.prisma.studentVerification.findUnique({ where: { id: p.data.id }, select: { id: true, proofKey: true, proofType: true } });
    if (!row?.proofKey || !app.storage) return reply.code(404).send({ error: "Not found" });
    const file = await app.storage.get(row.proofKey, { private: true });
    if (!file) return reply.code(404).send({ error: "Not found" });
    await audit(app.prisma, req.admin!.id, "student.proof_viewed", "StudentVerification", row.id);
    return reply
      .header("Content-Type", row.proofType)
      .header("Content-Disposition", "inline")
      .header("X-Content-Type-Options", "nosniff")
      .header("Cache-Control", "no-store")
      .header("Content-Security-Policy", "sandbox")
      .send(file.body);
  });

  for (const decision of ["approve", "reject"] as const) {
    app.post(`/:id/${decision}`, moderator, async (req, reply) => {
      const p = idParams.safeParse(req.params);
      if (!p.success) return reply.code(404).send({ error: "Not found" });
      let reason: string | null = null;
      if (decision === "reject") {
        const body = z.object({ reason: z.string().trim().min(1, "Enter a reason.").max(600) }).safeParse(req.body);
        if (!body.success) return invalid(reply, body.error);
        reason = sanitizeText(body.data.reason);
        if (reason.length < 5 || reason.length > 300) {
          return reply.code(400).send({ error: "Please check the highlighted fields.", fieldErrors: { reason: "Enter a reason of 5 to 300 characters." } });
        }
      }
      const row = await app.prisma.studentVerification.findUnique({ where: { id: p.data.id }, select: { id: true, userId: true } });
      if (!row) return reply.code(404).send({ error: "Not found" });
      const now = new Date();
      const done = await app.prisma.$transaction(async (tx) => {
        // Only a waiting request can be decided, and only once.
        const res = await tx.studentVerification.updateMany({
          where: { id: row.id, status: "PENDING" },
          data: {
            status: decision === "approve" ? "VERIFIED" : "REJECTED",
            decidedAt: now,
            decidedById: req.admin!.id,
            purgeAt: new Date(now.getTime() + DAY_MS),
            ...(reason ? { rejectionReason: reason } : {}),
          },
        });
        if (res.count === 0) return false;
        if (decision === "approve") {
          await tx.userBadge.upsert({
            where: { userId_badge: { userId: row.userId, badge: "STUDENT" } },
            create: { userId: row.userId, badge: "STUDENT" },
            update: {},
          });
        }
        await audit(tx, req.admin!.id, decision === "approve" ? "student.approved" : "student.rejected", "StudentVerification", row.id);
        return true;
      });
      if (!done) return reply.code(409).send({ error: "This request has already been decided." });
      return { ok: true, status: decision === "approve" ? "VERIFIED" : "REJECTED" };
    });
  }

  // Removes the STUDENT badge, for a mistake or abuse.
  app.post("/:userId/revoke", admin, async (req, reply) => {
    const p = z.object({ userId: z.string().min(1).max(64) }).safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const removed = await app.prisma.$transaction(async (tx) => {
      const del = await tx.userBadge.deleteMany({ where: { userId: p.data.userId, badge: "STUDENT" } });
      if (del.count) await audit(tx, req.admin!.id, "student.revoked", "User", p.data.userId);
      return del.count;
    });
    if (!removed) return reply.code(404).send({ error: "That member has no student badge." });
    return { ok: true };
  });
};

export default studentsAdminRoutes;
