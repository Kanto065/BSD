import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { sanitizeText } from "../../common/sanitize.js";
import { idParams, invalid } from "../admin/admin.service.js";

// M11-B, merchant side, mounted at /auth. The owner of an APPROVED listing writes one offer for it. Saving (re)sets it
// to PENDING, so nothing the owner types goes live before an admin approves it (Q-M11-8). A listing owned by someone
// else, or one that is not approved, is a 404.

const text = (min: number, max: number, label: string) =>
  z
    .string()
    .transform((v) => sanitizeText(v))
    .pipe(z.string().min(min, `${label} is too short.`).max(max, `${label} must be ${max} characters or fewer.`));

const offerBody = z
  .object({
    title: text(2, 150, "The title"),
    // A non percentage offer is described in the title and terms, so percent may be null.
    percent: z.number().min(0.01, "Enter 0.01 to 100.").max(100, "Enter 0.01 to 100.").nullable().optional(),
    terms: text(5, 500, "The terms"),
  })
  .strict();

const offerSelect = { id: true, title: true, percent: true, terms: true, status: true, rejectionReason: true, decidedAt: true, updatedAt: true } as const;
const present = <T extends { percent: unknown }>(o: T | null) => (o ? { ...o, percent: o.percent === null ? null : Number(o.percent) } : null);

const passMerchantRoutes: FastifyPluginAsync = async (app) => {
  const auth = { preHandler: app.requireUser() };
  app.addHook("onSend", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
  });

  const ownListing = (id: string, userId: string) => app.prisma.business.findFirst({ where: { id, ownerUserId: userId, status: "APPROVED" }, select: { id: true } });

  app.get("/listings/:id/offer", auth, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    if (!(await ownListing(p.data.id, req.user!.id))) return reply.code(404).send({ error: "Not found" });
    return { offer: present(await app.prisma.privilegeOffer.findUnique({ where: { businessId: p.data.id }, select: offerSelect })) };
  });

  app.put("/listings/:id/offer", { ...auth, config: { rateLimit: { max: 20, timeWindow: "1 hour" } } }, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    if (!(await ownListing(p.data.id, req.user!.id))) return reply.code(404).send({ error: "Not found" });
    const body = offerBody.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    const data = { title: body.data.title, percent: body.data.percent ?? null, terms: body.data.terms, status: "PENDING" as const, decidedAt: null, decidedById: null, rejectionReason: null };
    const offer = await app.prisma.privilegeOffer.upsert({ where: { businessId: p.data.id }, create: { businessId: p.data.id, ...data }, update: data, select: offerSelect });
    return { offer: present(offer) };
  });

  // One conditional UPDATE each, so a double tap or a race with an admin decision cannot skip a state.
  const flip = (name: "pause" | "resume", from: "ACTIVE" | "PAUSED", to: "PAUSED" | "ACTIVE") =>
    app.post(`/listings/:id/offer/${name}`, { ...auth, config: { rateLimit: { max: 30, timeWindow: "1 hour" } } }, async (req, reply) => {
      const p = idParams.safeParse(req.params);
      if (!p.success) return reply.code(404).send({ error: "Not found" });
      if (!(await ownListing(p.data.id, req.user!.id))) return reply.code(404).send({ error: "Not found" });
      const offer = await app.prisma.privilegeOffer.findUnique({ where: { businessId: p.data.id }, select: { status: true } });
      if (!offer) return reply.code(404).send({ error: "Not found" });
      const { count } = await app.prisma.privilegeOffer.updateMany({ where: { businessId: p.data.id, status: from }, data: { status: to } });
      if (!count && offer.status !== to) {
        return reply.code(409).send({ error: name === "pause" ? "Only a live offer can be paused." : "Only a paused offer can be resumed." });
      }
      return { offer: present(await app.prisma.privilegeOffer.findUnique({ where: { businessId: p.data.id }, select: offerSelect })) };
    });
  flip("pause", "ACTIVE", "PAUSED");
  flip("resume", "PAUSED", "ACTIVE");
};

export default passMerchantRoutes;
