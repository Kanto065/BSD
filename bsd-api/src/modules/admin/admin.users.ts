import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { hashPassword, temporaryPassword } from "../../common/passwords.js";
import { sanitizeText } from "../../common/sanitize.js";
import { audit, idParams, invalid } from "./admin.service.js";

// Team accounts. SUPER_ADMIN only. New and reset accounts get a one-time password that must be changed at first
// login. The one-time password is shown once, in the response, and never stored in plain text.

const ROLES = ["SUPER_ADMIN", "ADMIN", "MODERATOR", "VOLUNTEER"] as const;

const createBody = z.object({
  name: z.string().trim().min(2, "Enter a name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
  role: z.enum(ROLES),
});
const updateBody = z.object({ role: z.enum(ROLES).optional(), active: z.boolean().optional() }).strict();

const publicFields = { id: true, name: true, email: true, role: true, active: true, lastLoginAt: true, createdAt: true, mustChangePassword: true } as const;

const usersRoutes: FastifyPluginAsync = async (app) => {
  const superAdmin = { preHandler: app.requireRole("SUPER_ADMIN") };

  app.get("/users", superAdmin, async () => ({
    users: await app.prisma.adminUser.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], select: publicFields }),
  }));

  app.post("/users", superAdmin, async (req, reply) => {
    const body = createBody.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    if (await app.prisma.adminUser.findUnique({ where: { email: body.data.email } })) {
      return reply.code(409).send({ error: "Please check the highlighted fields.", fieldErrors: { email: "There is already an account with this email." } });
    }
    const oneTime = temporaryPassword();
    const user = await app.prisma.$transaction(async (tx) => {
      const u = await tx.adminUser.create({
        data: { name: sanitizeText(body.data.name), email: body.data.email, role: body.data.role, passwordHash: await hashPassword(oneTime), mustChangePassword: true },
        select: publicFields,
      });
      await audit(tx, req.admin!.id, "CREATE_ADMIN", "AdminUser", u.id, { email: u.email, role: u.role });
      return u;
    });
    return reply.code(201).send({ user, temporaryPassword: oneTime });
  });

  app.patch("/users/:id", superAdmin, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const body = updateBody.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    const target = await app.prisma.adminUser.findUnique({ where: { id: p.data.id } });
    if (!target) return reply.code(404).send({ error: "Not found" });
    if (target.id === req.admin!.id) return reply.code(409).send({ error: "You cannot change your own role or disable your own account." });

    // Never leave the site without an active Super Admin.
    const losesSuperAdmin = target.role === "SUPER_ADMIN" && target.active && ((body.data.role && body.data.role !== "SUPER_ADMIN") || body.data.active === false);
    if (losesSuperAdmin && (await app.prisma.adminUser.count({ where: { role: "SUPER_ADMIN", active: true } })) <= 1) {
      return reply.code(409).send({ error: "There must always be at least one active Super Admin." });
    }

    const user = await app.prisma.$transaction(async (tx) => {
      const u = await tx.adminUser.update({
        where: { id: target.id },
        // Any change to role or access ends the person's current sessions, so it applies straight away.
        data: { ...body.data, tokenVersion: { increment: 1 } },
        select: publicFields,
      });
      await audit(tx, req.admin!.id, "UPDATE_ADMIN", "AdminUser", target.id, { from: { role: target.role, active: target.active }, to: body.data });
      return u;
    });
    return { user };
  });

  app.post("/users/:id/reset-password", superAdmin, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const target = await app.prisma.adminUser.findUnique({ where: { id: p.data.id } });
    if (!target) return reply.code(404).send({ error: "Not found" });
    if (target.id === req.admin!.id) return reply.code(409).send({ error: "Use Change password for your own account." });
    const oneTime = temporaryPassword();
    await app.prisma.$transaction(async (tx) => {
      await tx.adminUser.update({
        where: { id: target.id },
        data: { passwordHash: await hashPassword(oneTime), mustChangePassword: true, tokenVersion: { increment: 1 }, failedLoginCount: 0, lockedUntil: null },
      });
      await audit(tx, req.admin!.id, "RESET_ADMIN_PASSWORD", "AdminUser", target.id);
    });
    return { temporaryPassword: oneTime };
  });
};

export default usersRoutes;
