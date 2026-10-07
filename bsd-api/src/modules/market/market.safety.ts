import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { sanitizeText } from "../../common/sanitize.js";
import { badQuery } from "../../common/public.js";
import { idParams, invalid } from "../admin/admin.service.js";
import { SELECTS, publicWhere, toListItem } from "./market.listings.js";

// Marketplace safety and support (M12-B): reports, saved listings and support tickets for signed in members.
// Nothing is emailed or pushed. A member sees ticket status and the admin reply on screen.

export const REPORT_REASONS = ["Scam or fraud", "Prohibited item", "Wrong category", "Offensive content", "Duplicate listing", "Other"] as const;
export const TICKET_CATEGORIES = ["Listing problem", "My account", "Safety concern", "Privilege Pass", "Other"] as const;
export const REPORTS_TO_HIDE = 3; // Q-M12-1
export const MAX_TICKETS_PER_DAY = 5;
const DAY = 24 * 60 * 60_000;

const reportBody = z.object({ reason: z.enum(REPORT_REASONS), note: z.string().trim().max(500).optional() }).strict();
const ticketBody = z
  .object({
    category: z.enum(TICKET_CATEGORIES),
    message: z.string().trim().min(10, "Write at least 10 characters.").max(2000, "Keep this under 2000 characters."),
    listingId: z.string().min(1).max(64).optional(),
  })
  .strict();
const savedQuery = z.object({ page: z.coerce.number().int().min(1).max(1000).default(1) });

const ticketSelect = { id: true, number: true, category: true, message: true, listingId: true, status: true, adminReply: true, createdAt: true, updatedAt: true } as const;

const marketSafetyRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onSend", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
  });
  const member = app.requireModule("MARKETPLACE");

  // ---- reports ----

  // Only a listing the public can see may be reported (others are a 404). A second report from the same person is a
  // no-op. The third distinct report sends an ACTIVE or RESERVED listing back to review (PENDING).
  app.post("/listings/:id/report", { preHandler: member, config: { rateLimit: { max: 20, timeWindow: "1 hour" } } }, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    const body = reportBody.safeParse(req.body);
    const listing = p.success
      ? await app.prisma.marketListing.findFirst({ where: publicWhere({ id: p.data.id, status: { in: ["ACTIVE", "RESERVED"] } }), select: { id: true, ownerUserId: true } })
      : null;
    if (!listing) return reply.code(404).send({ error: "Not found." });
    if (listing.ownerUserId === req.user!.id) return reply.code(400).send({ error: "You cannot report your own listing." });
    if (!body.success) return invalid(reply, body.error);
    // Checked first so the common repeat never raises a unique violation inside a transaction (also kills PGlite sockets in tests).
    if (await app.prisma.marketReport.findUnique({ where: { listingId_reporterUserId: { listingId: listing.id, reporterUserId: req.user!.id } }, select: { id: true } })) return { ok: true, already: true };
    try {
      const hidden = await app.prisma.$transaction(async (tx) => {
        await tx.marketReport.create({ data: { listingId: listing.id, reporterUserId: req.user!.id, reason: body.data.reason, note: body.data.note ? sanitizeText(body.data.note) : null } });
        const count = await tx.marketReport.count({ where: { listingId: listing.id } });
        const flip = count >= REPORTS_TO_HIDE;
        await tx.marketListing.update({ where: { id: listing.id }, data: { reportCount: count } });
        if (flip) await tx.marketListing.updateMany({ where: { id: listing.id, status: { in: ["ACTIVE", "RESERVED"] } }, data: { status: "PENDING" } });
        return flip;
      });
      return reply.code(201).send({ ok: true, underReview: hidden });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return { ok: true, already: true };
      throw err;
    }
  });

  // ---- saved listings ----

  app.get("/saves", { preHandler: member }, async (req, reply) => {
    const q = savedQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send(badQuery(q.error));
    const where = { userId: req.user!.id, listing: publicWhere({ status: { in: ["ACTIVE", "RESERVED", "SOLD"] } }) };
    const rows = await app.prisma.marketSave.findMany({ where, orderBy: { createdAt: "desc" }, skip: (q.data.page - 1) * 24, take: 24, select: { listing: { select: { ...SELECTS.listSelect, id: true, status: true } } } });
    return { page: q.data.page, items: rows.map(({ listing: { id, status, ...l } }) => ({ ...toListItem(l), id, status })) };
  });

  // PUT is idempotent. Saving a listing the public cannot see is a 404.
  app.put("/saves/:id", { preHandler: member, config: { rateLimit: { max: 120, timeWindow: "1 hour" } } }, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    const listing = p.success ? await app.prisma.marketListing.findFirst({ where: publicWhere({ id: p.data.id, status: { in: ["ACTIVE", "RESERVED", "SOLD"] } }), select: { id: true } }) : null;
    if (!listing) return reply.code(404).send({ error: "Not found." });
    const key = { userId_listingId: { userId: req.user!.id, listingId: listing.id } };
    await app.prisma.marketSave.upsert({ where: key, create: { userId: req.user!.id, listingId: listing.id }, update: {} });
    return { ok: true, saved: true };
  });

  app.delete("/saves/:id", { preHandler: member }, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found." });
    await app.prisma.marketSave.deleteMany({ where: { userId: req.user!.id, listingId: p.data.id } });
    return { ok: true, saved: false };
  });

  // ---- support tickets ----

  app.get("/ticket-categories", async () => ({ categories: TICKET_CATEGORIES }));

  app.post("/tickets", { preHandler: member }, async (req, reply) => {
    const body = ticketBody.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    const userId = req.user!.id;
    if ((await app.prisma.supportTicket.count({ where: { userId, createdAt: { gte: new Date(Date.now() - DAY) } } })) >= MAX_TICKETS_PER_DAY) {
      return reply.code(429).send({ error: `You can send up to ${MAX_TICKETS_PER_DAY} tickets a day. Please try again tomorrow.` });
    }
    let listingId: string | null = null;
    if (body.data.listingId) {
      // The member's own listing (any status) or one the public can see. Anything else looks like it does not exist.
      const found = await app.prisma.marketListing.findFirst({
        where: { id: body.data.listingId, OR: [{ ownerUserId: userId }, publicWhere({ status: { in: ["ACTIVE", "RESERVED", "SOLD"] } })] },
        select: { id: true },
      });
      if (!found) return reply.code(400).send({ error: "Please check the highlighted fields.", fieldErrors: { listingId: "That listing could not be found." } });
      listingId = found.id;
    }
    const [{ n }] = await app.prisma.$queryRaw<{ n: bigint }[]>`SELECT nextval('support_ticket_seq') AS n`;
    const ticket = await app.prisma.supportTicket.create({
      data: { number: `#BC-${String(n).padStart(4, "0")}`, userId, category: body.data.category, message: sanitizeText(body.data.message), listingId },
      select: ticketSelect,
    });
    return reply.code(201).send({ ok: true, ticket });
  });

  app.get("/tickets", { preHandler: member }, async (req) => {
    const items = await app.prisma.supportTicket.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: "desc" }, take: 100, select: ticketSelect });
    return { items };
  });
};

export default marketSafetyRoutes;
