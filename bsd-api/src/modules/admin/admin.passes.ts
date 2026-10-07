import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { rolesFrom } from "../../plugins/auth.js";
import { audit, idParams, invalid, page, pageQuery } from "./admin.service.js";

// M11-A admin side, mounted at /admin/passes. Moderators and above. Every change is audited. The secret and the device
// hash are never returned.

const passesAdminRoutes: FastifyPluginAsync = async (app) => {
  const moderator = { preHandler: app.requireRole(...rolesFrom("MODERATOR")) };
  app.addHook("onSend", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
  });

  app.get("/", moderator, async (req, reply) => {
    const q = pageQuery.extend({ q: z.string().trim().max(100).optional() }).safeParse(req.query);
    if (!q.success) return invalid(reply, q.error);
    const term = q.data.q;
    const where = term
      ? { OR: [{ cardNumber: { contains: term, mode: "insensitive" as const } }, { user: { name: { contains: term, mode: "insensitive" as const } } }, { user: { email: { contains: term, mode: "insensitive" as const } } }] }
      : {};
    const [total, rows] = await app.prisma.$transaction([
      app.prisma.privilegeCard.count({ where }),
      app.prisma.privilegeCard.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...page(q.data),
        select: {
          id: true, cardNumber: true, level: true, status: true, createdAt: true, deviceBoundAt: true, deviceMoves: true, deviceMovesResetAt: true, deviceHash: true,
          user: { select: { name: true, email: true, postcodeDistrict: true, deletedAt: true } },
        },
      }),
    ]);
    const items = rows.map(({ deviceHash, user, ...c }) => ({
      ...c,
      deviceBound: deviceHash !== null,
      user: { name: user.name, email: user.deletedAt ? null : user.email, postcodeDistrict: user.postcodeDistrict },
    }));
    return { items, total, page: q.data.page, pageSize: q.data.pageSize };
  });

  const actions = {
    suspend: { action: "PASS_SUSPEND", data: { status: "SUSPENDED" as const } },
    restore: { action: "PASS_RESTORE", data: { status: "ACTIVE" as const } },
    "reset-device": { action: "PASS_RESET_DEVICE", data: { deviceHash: null, deviceBoundAt: null, deviceMoves: 0, deviceMovesResetAt: null } },
  };
  for (const [name, a] of Object.entries(actions)) {
    app.post(`/:id/${name}`, moderator, async (req, reply) => {
      const p = idParams.safeParse(req.params);
      if (!p.success) return reply.code(404).send({ error: "Not found" });
      const found = await app.prisma.privilegeCard.findUnique({ where: { id: p.data.id }, select: { id: true } });
      if (!found) return reply.code(404).send({ error: "Not found" });
      await app.prisma.$transaction([
        app.prisma.privilegeCard.update({ where: { id: found.id }, data: a.data }),
        audit(app.prisma, req.admin!.id, a.action, "PrivilegeCard", found.id),
      ]);
      return { ok: true };
    });
  }
};

export default passesAdminRoutes;
