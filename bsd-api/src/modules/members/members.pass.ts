import crypto from "node:crypto";
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { SESSION_COOKIE } from "../../common/tokens.js";
import { deviceHashOf, makePassToken, newCardSecret, passSecretConfigured, qrSeconds } from "../../common/pass-token.js";

// M11-A, member side, mounted at /pass. The card secret is never returned. Device lock rules (Q-M11-3): the first
// phone to open the pass owns it, moving is one explicit tap, 3 moves per 7 days, then the BSD team resets it.

const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_MOVES = 3;
const MOVE_WINDOW_MS = 7 * DAY_MS;
const DEVICE_ID = /^[A-Za-z0-9-]{16,64}$/;

/** Signed in plus a CARD module row. Kept this small so it can be swapped for app.requireModule("CARD") (G0). */
export function requireCardModule(app: FastifyInstance) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    await app.requireUser()(req, reply);
    if (reply.sent) return;
    const row = await app.prisma.userModule.findUnique({ where: { userId_module: { userId: req.user!.id, module: "CARD" } } });
    if (!row) return reply.code(403).send({ error: "Join Privilege Pass to use this." });
  };
}

const cardNumber = () => `BC-${new Date().getUTCFullYear()}-${crypto.randomInt(100000, 1000000)}`;

const claimBody = z.object({ agreeShare: z.literal(true, { errorMap: () => ({ message: "Please agree to show your name and member number to shops." }) }) });

const membersPassRoutes: FastifyPluginAsync = async (app) => {
  const guard = { preHandler: requireCardModule(app) };
  app.addHook("onSend", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
  });

  const summary = (c: { cardNumber: string; level: number; status: string; createdAt: Date }, u: { name: string; postcodeDistrict: string }) => ({
    name: u.name,
    initials: u.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join(""),
    cardNumber: c.cardNumber,
    levelLabel: `Level ${c.level}: Resident`,
    district: u.postcodeDistrict,
    status: c.status,
    joinedAt: c.createdAt,
  });

  const loadUser = (id: string) => app.prisma.user.findUniqueOrThrow({ where: { id }, select: { name: true, postcodeDistrict: true } });
  const cardOf = (userId: string) => app.prisma.privilegeCard.findUnique({ where: { userId } });

  app.post("/claim", { ...guard, config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (req, reply) => {
    const body = claimBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Please check the highlighted fields.", fieldErrors: { agreeShare: body.error.issues[0]!.message } });
    const userId = req.user!.id;
    let card = await cardOf(userId);
    for (let i = 0; !card && i < 5; i++) {
      try {
        card = await app.prisma.privilegeCard.create({ data: { userId, cardNumber: cardNumber(), secret: newCardSecret() } });
      } catch (e) {
        // A unique clash is either a concurrent claim by this member (take theirs) or a card number clash (try another).
        card = await cardOf(userId);
        if (!card && i === 4) throw e;
      }
    }
    if (!card) return reply.code(503).send({ error: "Could not create your pass. Please try again." });
    return summary(card, await loadUser(userId));
  });

  app.get("/me", guard, async (req, reply) => {
    const card = await cardOf(req.user!.id);
    if (!card) return reply.code(404).send({ error: "You have not claimed your pass yet." });
    return summary(card, await loadUser(req.user!.id));
  });

  /** Reads and checks the x-device header. Null means a reply has been sent. */
  const deviceOf = (req: FastifyRequest, reply: FastifyReply) => {
    const d = req.headers["x-device"];
    if (typeof d !== "string" || !DEVICE_ID.test(d)) {
      reply.code(400).send({ error: "Open your pass again to continue." });
      return null;
    }
    return d;
  };

  const conflict = (reply: FastifyReply) => reply.code(409).send({ error: "Your pass is open on another device.", canMove: true });

  // Per card in practice: the key is the session cookie. ponytail: key by card id if one member shares sessions.
  const perSession = { keyGenerator: (req: FastifyRequest) => req.cookies?.[SESSION_COOKIE] ?? req.ip };

  app.get("/token", { ...guard, config: { rateLimit: { max: 30, timeWindow: "1 minute", ...perSession } } }, async (req, reply) => {
    const device = deviceOf(req, reply);
    if (!device) return;
    let card = await cardOf(req.user!.id);
    if (!card) return reply.code(404).send({ error: "You have not claimed your pass yet." });
    if (card.status !== "ACTIVE") return reply.code(403).send({ error: "This pass is suspended. Please contact the BSD team." });
    if (!passSecretConfigured()) {
      req.log.error("PASS_TOKEN_SECRET is not set, passes are disabled");
      return reply.code(503).send({ error: "The pass is not available right now." });
    }
    const hash = deviceHashOf(device, card.id);
    if (!card.deviceHash) {
      // First phone to open the pass owns it. The condition makes two racing first calls bind only one.
      await app.prisma.privilegeCard.updateMany({ where: { id: card.id, deviceHash: null }, data: { deviceHash: hash, deviceBoundAt: new Date() } });
      card = (await cardOf(req.user!.id))!;
    }
    if (card.deviceHash !== hash) return conflict(reply);
    const now = Date.now();
    const interval = qrSeconds();
    return { token: makePassToken(card, now), expiresInSeconds: interval - (Math.floor(now / 1000) % interval), serverTime: now };
  });

  app.post("/move", { ...guard, config: { rateLimit: { max: 10, timeWindow: "1 hour", ...perSession } } }, async (req, reply) => {
    const device = deviceOf(req, reply);
    if (!device) return;
    const card = await cardOf(req.user!.id);
    if (!card) return reply.code(404).send({ error: "You have not claimed your pass yet." });
    if (card.status !== "ACTIVE") return reply.code(403).send({ error: "This pass is suspended. Please contact the BSD team." });
    const hash = deviceHashOf(device, card.id);
    if (card.deviceHash === hash) return { ok: true };
    const now = new Date();
    const bind = { deviceHash: hash, deviceBoundAt: now };
    const base = { id: card.id, status: "ACTIVE" as const, deviceHash: { not: hash } };
    // Each branch is one conditional UPDATE, so concurrent moves cannot exceed the limit or double count.
    let moved = (
      await app.prisma.privilegeCard.updateMany({
        where: { ...base, OR: [{ deviceMovesResetAt: null }, { deviceMovesResetAt: { lte: now } }] },
        data: { ...bind, deviceMoves: 1, deviceMovesResetAt: new Date(now.getTime() + MOVE_WINDOW_MS) },
      })
    ).count;
    if (!moved) {
      moved = (
        await app.prisma.privilegeCard.updateMany({
          where: { ...base, deviceMovesResetAt: { gt: now }, deviceMoves: { lt: MAX_MOVES } },
          data: { ...bind, deviceMoves: { increment: 1 } },
        })
      ).count;
    }
    if (moved) return { ok: true };
    // Nothing changed: a double tap that already moved this phone, a suspension, or the limit.
    const now2 = await cardOf(req.user!.id);
    if (now2?.deviceHash === hash) return { ok: true };
    if (now2?.status !== "ACTIVE") return reply.code(403).send({ error: "This pass is suspended. Please contact the BSD team." });
    return reply.code(429).send({ error: "Ask the BSD team to reset your pass." });
  });

  app.get("/savings", guard, async (req) => {
    const card = await cardOf(req.user!.id);
    const empty = { totalPence: 0, count: 0, shops: 0, thisYearPence: 0 };
    if (!card) return empty;
    const confirmed = { cardId: card.id, confirmedAt: { not: null }, savingPence: { not: null } };
    const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
    const [all, year, shops] = await app.prisma.$transaction([
      app.prisma.privilegeRedemption.aggregate({ where: confirmed, _sum: { savingPence: true }, _count: { _all: true } }),
      app.prisma.privilegeRedemption.aggregate({ where: { ...confirmed, confirmedAt: { gte: yearStart } }, _sum: { savingPence: true } }),
      app.prisma.privilegeRedemption.groupBy({ by: ["businessId"], where: confirmed, orderBy: { businessId: "asc" } }),
    ]);
    return { totalPence: all._sum.savingPence ?? 0, count: all._count._all, shops: shops.length, thisYearPence: year._sum.savingPence ?? 0 };
  });
};

export default membersPassRoutes;
