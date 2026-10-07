import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { hashPassword, passwordProblem, verifyPassword } from "../../common/passwords.js";
import { checkCoverage } from "../../common/postcode.js";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signToken } from "../../common/tokens.js";
import { invalid } from "../admin/admin.service.js";
import { fieldRules } from "../businesses/businesses.submit.js";
import { sanitizeText } from "../../common/sanitize.js";
import businessProfileRoutes from "./members.business.js";
import ownerListingsRoutes from "./members.listings.js";

// The shared member login for bsd.wales, card.bsd.wales and marketplace.bsd.wales. The session is one httpOnly
// cookie on the parent domain (COOKIE_DOMAIN=.bsd.wales in production), so signing in on one site signs in on all.
// Each site a person uses is recorded as a UserModule row, which later gates what they can open.

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const WRONG = "Email or password is incorrect.";
export const DELETED_NAME = "Deleted account";

const moduleField = z.enum(["DIRECTORY", "CARD", "MARKETPLACE"]);

const accountType = z.enum(["GENERAL", "STUDENT"], { errorMap: () => ({ message: "Choose General or Student." }) });
const optionalPhone = fieldRules.phone.optional().or(z.literal("")).transform((v) => v || undefined);

const registerBody = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(100),
  email: z.string().trim().toLowerCase().email("Enter your email address.").max(200),
  password: z.string().max(200),
  postcode: z.string().trim().min(1, "Enter your postcode.").max(10),
  phone: optionalPhone,
  accountType,
  module: moduleField.default("DIRECTORY"),
});

const patchMeBody = z
  .object({
    name: z.string().trim().min(2, "Enter your name.").max(100),
    phone: z.union([fieldRules.phone, z.literal(""), z.null()]),
    postcode: z.string().trim().min(1, "Enter your postcode.").max(10),
    accountType,
  })
  .partial();

const passwordBody = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(200),
  newPassword: z.string().max(200),
});

const deleteBody = z.object({ password: z.string().min(1, "Enter your password.").max(200) });

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
      select: {
        id: true,
        name: true,
        email: true,
        postcode: true,
        phone: true,
        accountType: true,
        modules: { select: { module: true } },
        badges: { select: { badge: true } },
        _count: { select: { businesses: true } },
      },
    });
    const badges = u.badges.map((b) => b.badge);
    return {
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        postcode: u.postcode,
        phone: u.phone,
        accountType: u.accountType,
        // Only the STUDENT badge (given after a check by the BSD team) means verified. The account type is a claim.
        studentVerified: badges.includes("STUDENT"),
        listingCount: u._count.businesses,
        modules: u.modules.map((m) => m.module),
        badges,
      },
    };
  }

  app.post("/register", { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } }, async (req, reply) => {
    const body = registerBody.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    const { name, email, password, postcode, module, phone, accountType: type } = body.data;

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
        phone: phone ? sanitizeText(phone) : null,
        accountType: type,
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

    const found = await app.prisma.user.findUnique({ where: { email } });
    // A deleted account never signs in (its email is already replaced, this is a second guard).
    const user = found?.deletedAt ? null : found;
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

  app.patch("/me", { preHandler: app.requireUser(), config: { rateLimit: { max: 20, timeWindow: "1 hour" } } }, async (req, reply) => {
    const body = patchMeBody.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    const b = body.data; // email is not in the schema, so it is ignored (it is unverified and cannot be changed yet)
    const data: Prisma.UserUpdateInput = {};
    if (b.name !== undefined) data.name = sanitizeText(b.name);
    if (b.phone !== undefined) data.phone = b.phone ? sanitizeText(b.phone) : null;
    if (b.accountType !== undefined) data.accountType = b.accountType;
    if (b.postcode !== undefined) {
      const zones = await app.prisma.coverageZone.findMany({ select: { postcodeDistricts: true } });
      const area = checkCoverage(b.postcode, zones);
      if (!area.ok) return reply.code(400).send({ error: "Please check the highlighted fields.", fieldErrors: { postcode: area.message } });
      data.postcode = area.postcode;
      data.postcodeDistrict = area.outward;
    }
    if (Object.keys(data).length) await app.prisma.user.update({ where: { id: req.user!.id }, data });
    return profile(req.user!.id);
  });

  // Change password while signed in. A wrong current password counts toward the same lock as a failed login.
  app.post("/password", { preHandler: app.requireUser(), config: { rateLimit: { max: 5, timeWindow: "1 hour" } } }, async (req, reply) => {
    const body = passwordBody.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    const user = await app.prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      return reply.code(429).send({ error: `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.` });
    }
    if (!(await verifyPassword(body.data.currentPassword, user.passwordHash))) {
      const failed = user.failedLoginCount + 1;
      await app.prisma.user.update({
        where: { id: user.id },
        data: failed >= MAX_FAILED_LOGINS ? { failedLoginCount: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000) } : { failedLoginCount: failed },
      });
      return reply.code(400).send({ error: "Please check the highlighted fields.", fieldErrors: { currentPassword: "Your current password is not correct." } });
    }
    const problem = passwordProblem(body.data.newPassword, user.email);
    if (problem) return reply.code(400).send({ error: "Please check the highlighted fields.", fieldErrors: { newPassword: problem } });
    const updated = await app.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(body.data.newPassword), tokenVersion: { increment: 1 }, failedLoginCount: 0, lockedUntil: null },
    });
    setSessionCookie(reply, updated.id, updated.tokenVersion); // other sessions end, this browser stays signed in
    return { ok: true };
  });

  // Deletes the account after the password is checked again. Personal data is removed or replaced and the row stays, so
  // the listings, badges and student decision records that point at it keep working. The old email is freed.
  app.delete("/me", { preHandler: app.requireUser(), config: { rateLimit: { max: 5, timeWindow: "1 hour" } } }, async (req, reply) => {
    const body = deleteBody.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    const user = await app.prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      return reply.code(429).send({ error: `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.` });
    }
    if (!(await verifyPassword(body.data.password, user.passwordHash))) {
      const failed = user.failedLoginCount + 1;
      await app.prisma.user.update({
        where: { id: user.id },
        data: failed >= MAX_FAILED_LOGINS ? { failedLoginCount: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000) } : { failedLoginCount: failed },
      });
      return reply.code(400).send({ error: "Please check the highlighted fields.", fieldErrors: { password: "That password is not correct." } });
    }

    // Student proof files first. A file that cannot be deleted now is left for the purge job, which runs every 15 minutes.
    const proofs = await app.prisma.studentVerification.findMany({ where: { userId: user.id, proofKey: { not: null } }, select: { id: true, proofKey: true } });
    for (const row of proofs) {
      try {
        if (app.storage) await app.storage.delete(row.proofKey!, { private: true });
        await app.prisma.studentVerification.update({ where: { id: row.id }, data: { proofKey: null, purgedAt: now } });
      } catch {
        await app.prisma.studentVerification.update({ where: { id: row.id }, data: { purgeAt: now } });
      }
    }

    const passwordHash = await hashPassword(randomUUID()); // nobody knows it, so the old password is gone too
    await app.prisma.$transaction([
      app.prisma.studentVerification.updateMany({ where: { userId: user.id, status: "PENDING" }, data: { status: "EXPIRED", note: null } }),
      app.prisma.businessProfile.deleteMany({ where: { userId: user.id } }),
      // Waiting claims are closed so their document is purged, and every claim loses the personal details copied from the account.
      app.prisma.listingClaimRequest.updateMany({
        where: { userId: user.id, status: "PENDING" },
        data: { status: "REJECTED", decisionNote: "The member deleted the account.", reviewedAt: now, purgeAt: now },
      }),
      app.prisma.listingClaimRequest.updateMany({
        where: { userId: user.id },
        data: { userId: null, claimantName: DELETED_NAME, claimantEmail: `deleted-${user.id}@deleted.invalid`, claimantPhone: null },
      }),
      app.prisma.user.update({
        where: { id: user.id },
        data: {
          deletedAt: now,
          // .invalid is reserved and never delivers. The id keeps it unique, so the real address can register again.
          email: `deleted-${user.id}@deleted.invalid`,
          name: DELETED_NAME,
          phone: null,
          postcode: "",
          postcodeDistrict: "",
          passwordHash,
          failedLoginCount: 0,
          lockedUntil: null,
          tokenVersion: { increment: 1 }, // ends every session on every device
        },
      }),
    ]);
    reply.clearCookie(SESSION_COOKIE, { path: "/", domain: cookieDomain() });
    return { ok: true };
  });

  app.register(businessProfileRoutes);
  app.register(ownerListingsRoutes);

  // Joins a site on purpose, for a person who signed in elsewhere. Repeating it is harmless.
  app.post("/modules", { preHandler: app.requireUser(), config: { rateLimit: { max: 20, timeWindow: "1 hour" } } }, async (req, reply) => {
    const body = z.object({ module: moduleField }).safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    const userId = req.user!.id;
    await app.prisma.userModule.upsert({ where: { userId_module: { userId, module: body.data.module } }, create: { userId, module: body.data.module }, update: {} });
    return profile(userId);
  });
};

export default membersRoutes;
