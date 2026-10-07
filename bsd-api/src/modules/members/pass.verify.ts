import crypto from "node:crypto";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import { SESSION_COOKIE } from "../../common/tokens.js";
import { deviceHashOf, passTokenCardId, qrSeconds, verifyPassToken } from "../../common/pass-token.js";
import { badQuery, filterConditions, filterQuery, listPublicBusinesses } from "../../common/public.js";
import { idParams } from "../admin/admin.service.js";
import { DEVICE_ID } from "./members.pass.js";

// M11-B, mounted at /pass. Public partner grid, member one time codes, merchant scan verification and confirm.
// Who may scan (Q-M11-4): only the owner account of an APPROVED listing that has an ACTIVE offer. Anyone else gets 404.
// What a scanner learns about a member is exactly name, member number and postcode district (see `memberView`).

export const CODE_MINUTES = 10;
export const DUPLICATE_SECONDS = 10;
export const CONFIRM_MINUTES = 15;
const WRONG_CODE_LIMIT = 5;
const WRONG_CODE_WINDOW_MS = 10 * 60_000;

// Wrong code attempts per merchant account. In memory, so it resets on a restart and is per API process.
// ponytail: the API runs as one process; move this to a table if it is ever scaled out.
const wrongCodes = new Map<string, number[]>();
function recentWrong(userId: string, now: number) {
  const list = (wrongCodes.get(userId) ?? []).filter((t) => now - t < WRONG_CODE_WINDOW_MS);
  if (list.length) wrongCodes.set(userId, list);
  else wrongCodes.delete(userId);
  return list;
}

/** Pence saved. Integer maths on percent in hundredths so 12.5 percent of 1000p is exact. */
export const savingFor = (billPence: number, percent: number) => Math.round((billPence * Math.round(percent * 100)) / 10_000);

/** Start of the current day in Britain, for the till's daily summary. */
function startOfLondonDay(now: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(now).map((x) => [x.type, x.value]));
  return new Date(now.getTime() - ((Number(p.hour) * 60 + Number(p.minute)) * 60 + Number(p.second)) * 1000 - now.getMilliseconds());
}

const verifyBody = z.discriminatedUnion("type", [
  z.object({ businessId: z.string().min(1).max(64), type: z.literal("qr"), token: z.string().min(1).max(200) }),
  z.object({ businessId: z.string().min(1).max(64), type: z.literal("code"), code: z.string().trim().min(1).max(30) }),
]);
const confirmBody = z.object({ billPence: z.number().int().min(0).max(100_000).optional() }).strict();
const codeBody = z.object({ offerId: z.string().min(1).max(64) });
const terminalQuery = z.object({ businessId: z.string().min(1).max(64) });

const passVerifyRoutes: FastifyPluginAsync = async (app) => {
  const cardGuard = { preHandler: app.requireModule("CARD") };
  // Per session in practice. ponytail: key by account if one account shares sessions.
  const perSession = { keyGenerator: (req: FastifyRequest) => req.cookies?.[SESSION_COOKIE] ?? req.ip };

  // Public. Not cached by the shared proxy cache rule above: the list changes when an admin approves an offer.
  app.get("/partners", async (req, reply) => {
    const q = filterQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send(badQuery(q.error));
    const extra = [{ privilegeOffer: { status: "ACTIVE" as const } }, ...(await filterConditions(app.prisma, q.data))];
    return listPublicBusinesses(app.prisma, extra, q.data);
  });

  // Everything below is personal or live, so nothing may be cached.
  app.register(async (priv) => {
    priv.addHook("onSend", async (_req, reply) => {
      reply.header("Cache-Control", "no-store");
    });

    /** The merchant's own listing with its live offer, or null (the caller answers 404). */
    const scannable = (businessId: string, userId: string) =>
      app.prisma.business.findFirst({
        where: { id: businessId, ownerUserId: userId, status: "APPROVED", privilegeOffer: { status: "ACTIVE" } },
        select: { id: true, postcodeDistrict: true, privilegeOffer: { select: { id: true, title: true, percent: true, terms: true } } },
      });

    // ---- Member: reveal a one time code ----
    priv.post("/code", { ...cardGuard, config: { rateLimit: { max: 5, timeWindow: "1 hour", ...perSession } } }, async (req, reply) => {
      const body = codeBody.safeParse(req.body);
      if (!body.success) return reply.code(404).send({ error: "Not found" });
      const device = req.headers["x-device"];
      if (typeof device !== "string" || !DEVICE_ID.test(device)) return reply.code(400).send({ error: "Open your pass again to continue." });
      const card = await app.prisma.privilegeCard.findUnique({ where: { userId: req.user!.id } });
      if (!card) return reply.code(404).send({ error: "You have not claimed your pass yet." });
      if (card.status !== "ACTIVE") return reply.code(403).send({ error: "This pass is suspended. Please contact the BSD team." });
      const hash = deviceHashOf(device, card.id);
      if (!card.deviceHash) {
        await app.prisma.privilegeCard.updateMany({ where: { id: card.id, deviceHash: null }, data: { deviceHash: hash, deviceBoundAt: new Date() } });
        card.deviceHash = (await app.prisma.privilegeCard.findUniqueOrThrow({ where: { id: card.id }, select: { deviceHash: true } })).deviceHash;
      }
      if (card.deviceHash !== hash) return reply.code(409).send({ error: "Your pass is open on another device.", canMove: true });

      const offer = await app.prisma.privilegeOffer.findFirst({
        where: { id: body.data.offerId, status: "ACTIVE", business: { status: "APPROVED" } },
        select: { id: true, business: { select: { postcodeDistrict: true } } },
      });
      if (!offer) return reply.code(404).send({ error: "Not found" });

      const now = new Date();
      const live = await app.prisma.privilegeCode.findFirst({ where: { cardId: card.id, offerId: offer.id, usedAt: null, expiresAt: { gt: now } }, orderBy: { expiresAt: "desc" } });
      if (live) return { code: live.code, expiresAt: live.expiresAt, expiresInSeconds: Math.ceil((live.expiresAt.getTime() - now.getTime()) / 1000) };

      await app.prisma.privilegeCode.deleteMany({ where: { offerId: offer.id, expiresAt: { lt: now } } }); // keeps the 4 digit space free
      const expiresAt = new Date(now.getTime() + CODE_MINUTES * 60_000);
      for (let i = 0; i < 20; i++) {
        const code = `BC-${String(crypto.randomInt(0, 10_000)).padStart(4, "0")}-${offer.business.postcodeDistrict}`;
        try {
          await app.prisma.privilegeCode.create({ data: { cardId: card.id, offerId: offer.id, code, expiresAt } });
          return { code, expiresAt, expiresInSeconds: CODE_MINUTES * 60 };
        } catch (e) {
          // The unique (offer, code) clash means another member holds this code right now: draw again.
          const again = await app.prisma.privilegeCode.findFirst({ where: { cardId: card.id, offerId: offer.id, usedAt: null, expiresAt: { gt: new Date() } } });
          if (again) return { code: again.code, expiresAt: again.expiresAt, expiresInSeconds: Math.ceil((again.expiresAt.getTime() - Date.now()) / 1000) };
          if (i === 19) throw e;
        }
      }
      return reply.code(503).send({ error: "Could not make a code. Please try again." });
    });

    // ---- Merchant: verify a scanned QR or a typed code ----
    priv.post("/verify", { ...cardGuard, config: { rateLimit: { max: 10, timeWindow: "1 minute", ...perSession } } }, async (req, reply) => {
      const body = verifyBody.safeParse(req.body);
      if (!body.success) return reply.code(400).send({ error: "Scan a pass or type a code." });
      const me = req.user!.id;
      const biz = await scannable(body.data.businessId, me);
      if (!biz || !biz.privilegeOffer) return reply.code(404).send({ error: "Not found" });
      const offer = biz.privilegeOffer;
      const now = Date.now();
      const invalid = (reason: "invalid" | "expired" | "used") => ({ valid: false as const, reason, serverTime: now });

      // Finds the card for this scan, or a reason it is not good. A code is consumed later, after the duplicate check.
      type Card = { id: string; cardNumber: string; user: { name: string; postcodeDistrict: string } };
      let card: Card | null = null;
      let codeId: string | null = null;

      if (body.data.type === "qr") {
        const cardId = passTokenCardId(body.data.token);
        const row = cardId ? await app.prisma.privilegeCard.findUnique({ where: { id: cardId }, include: { user: { select: { name: true, postcodeDistrict: true, deletedAt: true } } } }) : null;
        if (!row || row.status !== "ACTIVE" || row.user.deletedAt) return invalid("invalid");
        if (!verifyPassToken(body.data.token, row, now)) {
          // Same MAC but a slot that has passed counts as expired, anything else as invalid.
          const step = qrSeconds() * 1000;
          const wasValid = verifyPassToken(body.data.token, row, now - 2 * step) || verifyPassToken(body.data.token, row, now - 4 * step);
          return invalid(wasValid ? "expired" : "invalid");
        }
        card = row;
      } else {
        if (recentWrong(me, now).length >= WRONG_CODE_LIMIT) return reply.code(429).send({ error: "Too many wrong codes. Please wait a few minutes." });
        const code = body.data.code.toUpperCase().replace(/\s+/g, "");
        const row = await app.prisma.privilegeCode.findUnique({
          where: { offerId_code: { offerId: offer.id, code } },
          include: { card: { include: { user: { select: { name: true, postcodeDistrict: true, deletedAt: true } } } } },
        });
        if (!row || row.card.status !== "ACTIVE" || row.card.user.deletedAt) {
          wrongCodes.set(me, [...recentWrong(me, now), now]);
          return invalid("invalid");
        }
        if (row.expiresAt.getTime() <= now) return invalid("expired");
        card = row.card;
        if (row.usedAt) {
          // A second look at a code that was just used is the yellow state, not an error.
          const recent = await app.prisma.privilegeRedemption.findFirst({ where: { cardId: card.id, businessId: biz.id, scannedAt: { gte: new Date(now - DUPLICATE_SECONDS * 1000) } }, orderBy: { scannedAt: "desc" } });
          return recent ? { valid: true, duplicate: true, secondsAgo: Math.floor((now - recent.scannedAt.getTime()) / 1000), serverTime: now } : invalid("used");
        }
        codeId = row.id;
      }

      const c: Card = card;
      // Serialise scans of one pass at one shop, so two simultaneous scans cannot both create a redemption.
      const result = await app.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${c.id + ":" + biz.id}))`;
        const recent = await tx.privilegeRedemption.findFirst({ where: { cardId: c.id, businessId: biz.id, scannedAt: { gte: new Date(now - DUPLICATE_SECONDS * 1000) } }, orderBy: { scannedAt: "desc" } });
        if (recent) return { duplicate: Math.floor((now - recent.scannedAt.getTime()) / 1000) };
        if (codeId) {
          const used = await tx.privilegeCode.updateMany({ where: { id: codeId, usedAt: null, expiresAt: { gt: new Date(now) } }, data: { usedAt: new Date(now) } });
          if (!used.count) return { used: true as const };
        }
        const r = await tx.privilegeRedemption.create({ data: { cardId: c.id, offerId: offer.id, businessId: biz.id, scannedByUserId: me, method: codeId ? "CODE" : "QR", scannedAt: new Date(now) }, select: { id: true } });
        return { id: r.id };
      });
      if ("duplicate" in result) return { valid: true, duplicate: true, secondsAgo: result.duplicate, serverTime: now };
      if ("used" in result) return invalid("used");
      return {
        valid: true,
        member: { memberId: c.cardNumber, name: c.user.name, postcodeDistrict: c.user.postcodeDistrict },
        offer: { title: offer.title, percent: offer.percent === null ? null : Number(offer.percent), terms: offer.terms },
        redemptionId: result.id,
        serverTime: now,
      };
    });

    // ---- Merchant: confirm the discount once the bill is known ----
    priv.post("/redemptions/:id/confirm", { ...cardGuard, config: { rateLimit: { max: 30, timeWindow: "1 minute", ...perSession } } }, async (req, reply) => {
      const p = idParams.safeParse(req.params);
      if (!p.success) return reply.code(404).send({ error: "Not found" });
      const body = confirmBody.safeParse(req.body ?? {});
      if (!body.success) return reply.code(400).send({ error: "Enter the bill as an amount between 0 and 1000 pounds." });
      const row = await app.prisma.privilegeRedemption.findFirst({
        where: { id: p.data.id, scannedByUserId: req.user!.id },
        select: { id: true, scannedAt: true, confirmedAt: true, offer: { select: { percent: true } } },
      });
      if (!row) return reply.code(404).send({ error: "Not found" });
      const bill = body.data.billPence ?? null;
      const percent = row.offer.percent === null ? null : Number(row.offer.percent);
      const saving = bill !== null && percent !== null ? savingFor(bill, percent) : null;
      const now = Date.now();
      const { count } = await app.prisma.privilegeRedemption.updateMany({
        where: { id: row.id, confirmedAt: null, scannedAt: { gte: new Date(now - CONFIRM_MINUTES * 60_000) } },
        data: { confirmedAt: new Date(now), billPence: bill, savingPence: saving },
      });
      if (!count) return reply.code(409).send({ error: row.confirmedAt ? "This discount was already confirmed." : "This scan is too old to confirm. Please scan again." });
      return { ok: true, billPence: bill, savingPence: saving };
    });

    // ---- Merchant: today's numbers for the till ----
    priv.get("/terminal/today", { ...cardGuard, config: { rateLimit: { max: 60, timeWindow: "1 minute", ...perSession } } }, async (req, reply) => {
      const q = terminalQuery.safeParse(req.query);
      if (!q.success) return reply.code(404).send({ error: "Not found" });
      const owned = await app.prisma.business.findFirst({ where: { id: q.data.businessId, ownerUserId: req.user!.id, status: "APPROVED" }, select: { id: true } });
      if (!owned) return reply.code(404).send({ error: "Not found" });
      const where = { businessId: owned.id, scannedAt: { gte: startOfLondonDay(new Date()) } };
      const [scans, confirmed, last] = await app.prisma.$transaction([
        app.prisma.privilegeRedemption.count({ where }),
        app.prisma.privilegeRedemption.aggregate({ where: { ...where, confirmedAt: { not: null } }, _count: { _all: true }, _sum: { savingPence: true } }),
        app.prisma.privilegeRedemption.findFirst({ where, orderBy: { scannedAt: "desc" }, select: { scannedAt: true } }),
      ]);
      return { scans, confirmed: confirmed._count._all, savingsPence: confirmed._sum.savingPence ?? 0, lastScanAt: last?.scannedAt ?? null };
    });
  });
};

export default passVerifyRoutes;
