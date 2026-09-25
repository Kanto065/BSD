import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import { hashPassword, passwordProblem, PASSWORD_RULES, verifyPassword } from "../../common/passwords.js";
import { REFRESH_COOKIE, REFRESH_TTL_SECONDS, signToken, verifyToken } from "../../common/tokens.js";
import { audit, invalid } from "./admin.service.js";

// Sign in, keep the session alive, sign out, and change password.

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const WRONG = "Email or password is incorrect.";

const loginBody = z.object({
  email: z.string().trim().toLowerCase().email("Enter your email address.").max(200),
  password: z.string().min(1, "Enter your password.").max(200),
});

const changeBody = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(200),
  newPassword: z.string().max(200),
});

function setRefreshCookie(reply: FastifyReply, token: string) {
  reply.setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin",
    maxAge: REFRESH_TTL_SECONDS,
  });
}

function clearRefreshCookie(reply: FastifyReply) {
  reply.clearCookie(REFRESH_COOKIE, { path: "/admin" });
}

type SessionAdmin = { id: string; name: string; email: string; role: string; mustChangePassword: boolean; tokenVersion: number };

function startSession(reply: FastifyReply, admin: SessionAdmin) {
  setRefreshCookie(reply, signToken("refresh", admin.id, admin.tokenVersion));
  return {
    accessToken: signToken("access", admin.id, admin.tokenVersion),
    admin: { name: admin.name, email: admin.email, role: admin.role, mustChangePassword: admin.mustChangePassword },
  };
}

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/login", { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } }, async (req, reply) => {
    const body = loginBody.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    const { email, password } = body.data;

    const admin = await app.prisma.adminUser.findUnique({ where: { email } });
    const now = new Date();
    if (admin?.lockedUntil && admin.lockedUntil > now) {
      return reply.code(429).send({ error: `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.` });
    }
    // Always run the hash comparison, even for unknown emails, so timing does not reveal which accounts exist.
    const ok = await verifyPassword(password, admin?.passwordHash);
    if (!admin || !ok || !admin.active) {
      if (admin && !ok) {
        const failed = admin.failedLoginCount + 1;
        await app.prisma.adminUser.update({
          where: { id: admin.id },
          data:
            failed >= MAX_FAILED_LOGINS
              ? { failedLoginCount: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000) }
              : { failedLoginCount: failed },
        });
      }
      return reply.code(401).send({ error: WRONG });
    }

    const updated = await app.prisma.adminUser.update({
      where: { id: admin.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now },
    });
    await audit(app.prisma, admin.id, "LOGIN", "AdminUser", admin.id);
    return startSession(reply, updated);
  });

  app.post("/refresh", async (req, reply) => {
    const claims = verifyToken(req.cookies[REFRESH_COOKIE] ?? "", "refresh");
    const admin = claims ? await app.prisma.adminUser.findUnique({ where: { id: claims.sub } }) : null;
    if (!claims || !admin || !admin.active || admin.tokenVersion !== claims.tv) {
      clearRefreshCookie(reply);
      return reply.code(401).send({ error: "Please sign in." });
    }
    return startSession(reply, admin);
  });

  // Signing out ends every session for this admin (all devices), by bumping the token version.
  app.post("/logout", async (req, reply) => {
    const claims = verifyToken(req.cookies[REFRESH_COOKIE] ?? "", "refresh");
    if (claims) {
      await app.prisma.adminUser.updateMany({ where: { id: claims.sub, tokenVersion: claims.tv }, data: { tokenVersion: { increment: 1 } } });
    }
    clearRefreshCookie(reply);
    return { ok: true };
  });

  app.get("/me", { preHandler: app.requireRole(), config: { allowWithTemporaryPassword: true } }, async (req) => ({
    admin: req.admin,
    passwordRules: PASSWORD_RULES,
  }));

  app.post(
    "/change-password",
    { preHandler: app.requireRole(), config: { allowWithTemporaryPassword: true, rateLimit: { max: 10, timeWindow: "15 minutes" } } },
    async (req, reply) => {
      const body = changeBody.safeParse(req.body);
      if (!body.success) return invalid(reply, body.error);
      const admin = await app.prisma.adminUser.findUniqueOrThrow({ where: { id: req.admin!.id } });
      if (!(await verifyPassword(body.data.currentPassword, admin.passwordHash))) {
        return reply.code(400).send({ error: "Please check the highlighted fields.", fieldErrors: { currentPassword: "Your current password is not correct." } });
      }
      const problem = passwordProblem(body.data.newPassword, admin.email);
      if (problem) return reply.code(400).send({ error: "Please check the highlighted fields.", fieldErrors: { newPassword: problem } });
      if (await verifyPassword(body.data.newPassword, admin.passwordHash)) {
        return reply.code(400).send({ error: "Please check the highlighted fields.", fieldErrors: { newPassword: "Choose a password you have not used here before." } });
      }
      // A new token version signs out every other session. This one continues with fresh tokens.
      const updated = await app.prisma.$transaction(async (tx) => {
        const u = await tx.adminUser.update({
          where: { id: admin.id },
          data: { passwordHash: await hashPassword(body.data.newPassword), mustChangePassword: false, tokenVersion: { increment: 1 } },
        });
        await audit(tx, admin.id, "CHANGE_PASSWORD", "AdminUser", admin.id);
        return u;
      });
      return startSession(reply, updated);
    }
  );
};

export default authRoutes;
