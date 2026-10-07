import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { MarketStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { badQuery } from "../../common/public.js";
import { idParams } from "../admin/admin.service.js";
import {
  LISTING_DAYS, MarketError, SELECTS, createListing, editListing, editSchema, publicWhere, readMultipart, toDetail, toListItem, toMine,
} from "./market.listings.js";

// Marketplace API (M12-A). Public reads, then the member routes for a person's own listings.
// A listing owned by someone else is a 404, never a 403, so its existence is not revealed.

const DAY = 24 * 60 * 60_000;
const PAGE_SIZE = 24;
export const CONTACT_COOLDOWN_MS = 10_000;
const CONTACT_TOKEN_TTL_MS = 10 * 60_000;

// The contact cooldown needs no stored state: the first call hands out a signed timestamp and the number is released
// only when that token is at least 10 seconds old. Nothing about the visitor (no IP, no cookie) is kept.
function sign(listingId: string, issuedAt: number): string {
  const secret = process.env.JWT_SECRET ?? "";
  const mac = createHmac("sha256", secret).update(`contact:${listingId}:${issuedAt}`).digest("hex").slice(0, 32);
  return `${issuedAt}.${mac}`;
}
export function contactTokenAge(listingId: string, token: string, now = Date.now()): number | null {
  const [ts, mac] = token.split(".");
  const issuedAt = Number(ts);
  if (!mac || !Number.isFinite(issuedAt)) return null;
  const expected = sign(listingId, issuedAt).split(".")[1]!;
  if (mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  const age = now - issuedAt;
  return age < 0 || age > CONTACT_TOKEN_TTL_MS ? null : age;
}

const listQuery = z.object({
  kind: z.enum(["SELL", "BUY", "GIVEAWAY", "SERVICE"]).optional(),
  category: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,100}$/).optional(),
  zone: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,100}$/).optional(),
  district: z.string().trim().toUpperCase().regex(/^[A-Z]{1,2}\d[A-Z\d]?$/).optional(),
  q: z.string().trim().max(100).optional(),
  free: z.enum(["true", "false"]).optional(),
  b2b: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
const slugParams = z.object({ slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,100}$/) });

const marketRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onSend", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
  });

  const member = app.requireModule("MARKETPLACE");

  const fail = (reply: FastifyReply, err: unknown) => {
    if (err instanceof MarketError) return reply.code(err.status).send({ ok: false, error: err.message, fieldErrors: err.fieldErrors });
    throw err;
  };

  // ---- public ----

  app.get("/categories", async () => {
    const rows = await app.prisma.marketCategory.findMany({ where: { staged: false }, orderBy: { sortOrder: "asc" }, select: { name: true, slug: true } });
    return { categories: rows };
  });

  app.get("/spots", async () => {
    return { spots: await app.prisma.safeSpot.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, address: true, postcodeDistrict: true } }) };
  });

  app.get("/listings", async (req, reply) => {
    const q = listQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send(badQuery(q.error));
    const f = q.data;
    const and: Prisma.MarketListingWhereInput[] = [{ status: "ACTIVE" }];
    if (f.kind) and.push({ kind: f.kind });
    if (f.category) and.push({ category: { slug: f.category } });
    if (f.district) and.push({ postcodeDistrict: f.district });
    if (f.zone) {
      const zone = await app.prisma.coverageZone.findUnique({ where: { slug: f.zone }, select: { postcodeDistricts: true } });
      and.push({ postcodeDistrict: { in: zone?.postcodeDistricts ?? [] } });
    }
    if (f.free === "true") and.push({ kind: "GIVEAWAY" });
    if (f.b2b === "true") and.push({ isB2B: true });
    if (f.q) and.push({ OR: [{ title: { contains: f.q, mode: "insensitive" } }, { description: { contains: f.q, mode: "insensitive" } }] });
    const where = publicWhere({ AND: and });
    const [total, rows] = await Promise.all([
      app.prisma.marketListing.count({ where }),
      app.prisma.marketListing.findMany({ where, select: SELECTS.listSelect, orderBy: { bumpedAt: "desc" }, skip: (f.page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    ]);
    return { total, page: f.page, pageSize: PAGE_SIZE, items: rows.map(toListItem) };
  });

  const visible = (slug: string) => publicWhere({ slug, status: { in: ["ACTIVE", "RESERVED", "SOLD"] } });

  // No view counter. See the note in schema.prisma.
  app.get("/listings/:slug", async (req, reply) => {
    const p = slugParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found." });
    const row = await app.prisma.marketListing.findFirst({ where: visible(p.data.slug), select: SELECTS.detailSelect });
    if (!row) return reply.code(404).send({ error: "Not found." });
    return toDetail(row);
  });

  // First call returns a token and the wait. A call with the token after 10 seconds returns the number to ring.
  app.get("/listings/:slug/contact", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (req, reply) => {
    const p = slugParams.safeParse(req.params);
    const row = p.success ? await app.prisma.marketListing.findFirst({ where: visible(p.data.slug), select: { id: true, phone: true, whatsapp: true } }) : null;
    if (!row) return reply.code(404).send({ error: "Not found." });
    const token = (req.query as { token?: unknown }).token;
    if (typeof token !== "string" || token === "") {
      return { ready: false, retryAfterSeconds: CONTACT_COOLDOWN_MS / 1000, token: sign(row.id, Date.now()) };
    }
    const age = contactTokenAge(row.id, token);
    if (age === null) return reply.code(400).send({ error: "Please try again." });
    if (age < CONTACT_COOLDOWN_MS) return reply.code(425).send({ ready: false, retryAfterSeconds: Math.ceil((CONTACT_COOLDOWN_MS - age) / 1000), error: "Please wait a few seconds." });
    return { ready: true, phone: row.phone ?? row.whatsapp };
  });

  // ---- member ----

  app.post("/listings", { preHandler: member, config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (req, reply) => {
    try {
      const listing = await createListing(app.prisma, app.storage, req.user!.id, await readMultipart(req));
      return reply.code(201).send({ ok: true, listing, held: listing.status === "PENDING" });
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.get("/mine", { preHandler: member }, async (req) => {
    const rows = await app.prisma.marketListing.findMany({ where: { ownerUserId: req.user!.id }, select: SELECTS.mineSelect, orderBy: { createdAt: "desc" }, take: 200 });
    return { items: rows.map(toMine) };
  });

  const own = async (req: FastifyRequest, reply: FastifyReply) => {
    const p = idParams.safeParse(req.params);
    const row = p.success ? await app.prisma.marketListing.findFirst({ where: { id: p.data.id, ownerUserId: req.user!.id }, select: { id: true, kind: true, isB2B: true, status: true, bumpedAt: true } }) : null;
    if (!row) {
      reply.code(404).send({ error: "Not found." });
      return null;
    }
    return row;
  };

  app.patch("/listings/:id", { preHandler: member }, async (req, reply) => {
    const row = await own(req, reply);
    if (!row) return;
    if (row.status === "REMOVED") return reply.code(409).send({ error: "This listing was removed." });
    const body = editSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ ok: false, error: "Please check the highlighted fields.", fieldErrors: Object.fromEntries(body.error.issues.map((i) => [String(i.path[0] ?? "form"), i.message])) });
    try {
      return { ok: true, listing: await editListing(app.prisma, row, body.data) };
    } catch (err) {
      return fail(reply, err);
    }
  });

  // Status changes. `from` is where the move may start. A listing held for review (PENDING) or removed never moves
  // by itself, so these routes cannot be used to skip moderation.
  const move = (name: string, from: MarketStatus[], to: MarketStatus, extra: (r: { bumpedAt: Date }, now: Date) => Prisma.MarketListingUpdateInput | null = () => ({})) =>
    app.post(`/listings/:id/${name}`, { preHandler: member }, async (req, reply) => {
      const row = await own(req, reply);
      if (!row) return;
      if (!from.includes(row.status)) return reply.code(409).send({ error: "That is not possible for this listing right now." });
      const now = new Date();
      const more = extra(row, now);
      if (more === null) return reply.code(429).send({ error: "A listing can be relisted once every 24 hours." });
      const closed = to === "ARCHIVED" || to === "SOLD";
      const updated = await app.prisma.marketListing.update({ where: { id: row.id }, data: { status: to, ...(closed ? { closedAt: now } : { closedAt: null }), ...more }, select: SELECTS.mineSelect });
      return { ok: true, listing: toMine(updated) };
    });
  move("sold", ["ACTIVE", "RESERVED"], "SOLD");
  move("reserve", ["ACTIVE"], "RESERVED");
  move("archive", ["ACTIVE", "RESERVED"], "ARCHIVED");
  move("relist", ["ACTIVE", "RESERVED", "ARCHIVED"], "ACTIVE", (r, now) =>
    now.getTime() - r.bumpedAt.getTime() < DAY ? null : { bumpedAt: now, expiresAt: new Date(now.getTime() + LISTING_DAYS * DAY) }
  );

  app.delete("/listings/:id", { preHandler: member }, async (req, reply) => {
    const row = await own(req, reply);
    if (!row) return;
    const images = await app.prisma.marketImage.findMany({ where: { listingId: row.id }, select: { key: true, thumbKey: true } });
    await app.prisma.marketListing.delete({ where: { id: row.id } });
    if (app.storage) await Promise.allSettled(images.flatMap((i) => [app.storage!.delete(i.key), app.storage!.delete(i.thumbKey)]));
    return { ok: true };
  });
};

export default marketRoutes;
