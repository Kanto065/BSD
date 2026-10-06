import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import { hashPassword, passwordProblem, verifyPassword } from "../../common/passwords.js";
import { checkCoverage } from "../../common/postcode.js";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signToken } from "../../common/tokens.js";
import { invalid } from "../admin/admin.service.js";

// The shared member login for bsd.wales, card.bsd.wales and marketplace.bsd.wales. The session is one httpOnly
// cookie on the parent domain (COOKIE_DOMAIN=.bsd.wales in production), so signing in on one site signs in on all.
// Each site a person uses is recorded as a UserModule row, which later gates what they can open.

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const WRONG = "Email or password is incorrect.";

const moduleField = z.enum(["DIRECTORY", "CARD", "MARKETPLACE"]);

const registerBody = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(100),
  email: z.string().trim().toLowerCase().email("Enter your email address.").max(200),
  password: z.string().max(200),
  postcode: z.string().trim().min(1, "Enter your postcode.").max(10),
  module: moduleField.default("DIRECTORY"),
});

const loginBody = z.object({
  email: z.string().trim().toLowerCase().email("Enter your email address.").max(200),
  password: z.string().min(1, "Enter your password.").max(200),
  module: moduleField.default("DIRECTORY"),
});

const cookieDomain = () => process.env.COOKIE_DOMAIN || undefined;

function setSessionCookie(reply: FastifyReply, userId: string, tokenVersion: number) {
  reply.setCookie(SESSION_COOKIE, signToken("session", userId, tokenVersion), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain: cookieDomain(),
    maxAge: SESSION_TTL_SECONDS,
  });
}

const membersRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onSend", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
  });

  async function profile(userId: string) {
    const u = await app.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, name: true, email: true, postcode: true, modules: { select: { module: true } }, badges: { select: { badge: true } } },
    });
    return { user: { id: u.id, name: u.name, email: u.email, postcode: u.postcode, modules: u.modules.map((m) => m.module), badges: u.badges.map((b) => b.badge) } };
  }

  app.post("/register", { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } }, async (req, reply) => {
    const body = registerBody.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    const { name, email, password, postcode, module } = body.data;

    const problem = passwordProblem(password, email);
    if (problem) return reply.code(400).send({ error: "Please check the highlighted fields.", fieldErrors: { password: problem } });
    const zones = await app.prisma.coverageZone.findMany({ select: { postcodeDistricts: true } });
    const area = checkCoverage(postcode, zones);
    if (!area.ok) return reply.code(400).send({ error: "Please check the highlighted fields.", fieldErrors: { postcode: area.message } });
    if (await app.prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      return reply.code(409).send({ error: "Please check the highlighted fields.", fieldErrors: { email: "An account with this email already exists. Sign in instead." } });
    }

    const user = await app.prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        postcode: area.postcode,
        postcodeDistrict: area.outward,
        lastLoginAt: new Date(),
        modules: { create: { module } },
        badges: { create: { badge: "MEMBER" } },
      },
    });
    setSessionCookie(reply, user.id, user.tokenVersion);
    return reply.code(201).send(await profile(user.id));
  });

  app.post("/login", { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } }, async (req, reply) => {
    const body = loginBody.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    const { email, password, module } = body.data;

    const user = await app.prisma.user.findUnique({ where: { email } });
    const now = new Date();
    if (user?.lockedUntil && user.lockedUntil > now) {
      return reply.code(429).send({ error: `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.` });
    }
    // Always compare, even for unknown emails, so timing does not reveal which accounts exist.
    const ok = await verifyPassword(password, user?.passwordHash);
    if (!user || !ok) {
      if (user) {
        const failed = user.failedLoginCount + 1;
        await app.prisma.user.update({
          where: { id: user.id },
          data: failed >= MAX_FAILED_LOGINS ? { failedLoginCount: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000) } : { failedLoginCount: failed },
        });
      }
      return reply.code(401).send({ error: WRONG });
    }

    await app.prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now } });
    // Signing in on a site joins it.
    await app.prisma.userModule.upsert({ where: { userId_module: { userId: user.id, module } }, create: { userId: user.id, module }, update: {} });
    setSessionCookie(reply, user.id, user.tokenVersion);
    return profile(user.id);
  });

  // Signs out this browser on every site (the cookie is shared). Other devices stay signed in.
  app.post("/logout", async (_req, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: "/", domain: cookieDomain() });
    return { ok: true };
  });

  app.get("/me", { preHandler: app.requireUser() }, async (req) => profile(req.user!.id));
};

export default membersRoutes;
