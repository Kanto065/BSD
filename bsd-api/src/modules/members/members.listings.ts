import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { sanitizeText, sanitizeTextArray } from "../../common/sanitize.js";
import { idParams, invalid } from "../admin/admin.service.js";
import { descriptionProblem, fieldRules } from "../businesses/businesses.submit.js";

// A member's own listings. The owner may change contact and descriptive fields and the email visibility switch at once.
// Name, category, subcategory, postcode and zone, status and verification stay with the BSD team, because they change
// moderation or the zone. A listing owned by someone else is a 404, never a 403, so its existence is not revealed.

const { text, slug, phone } = fieldRules;
// A text field the owner may also clear, with an empty string or null. (optionalText turns "" into "no change".)
const clearable = (max: number) => z.union([text(max), z.null()]);

// Strict, so a request that tries to change name, postcode or status is refused rather than silently ignored.
const editBody = z
  .object({
    description: text(2000), // the length and word rule runs after sanitising, see descriptionProblem
    servicesOffered: z.array(text(100)).min(1, "List at least one service.").max(15),
    ownerName: clearable(120),
    phone,
    whatsapp: z.union([phone, z.literal(""), z.null()]),
    email: z.union([z.string().trim().max(200).email("Enter a valid email address."), z.literal(""), z.null()]),
    showEmail: z.boolean(),
    websiteOrSocial: clearable(300),
    address: clearable(300),
    hideFullAddress: z.boolean(),
    openingHours: clearable(500),
    specialNotes: clearable(500),
    otherAreaText: clearable(300),
    serveZones: z.array(slug).max(3),
    localities: z.array(slug).max(60),
  })
  .partial()
  .strict();

const detailSelect = {
  id: true,
  slug: true,
  name: true,
  status: true,
  verificationStatus: true,
  description: true,
  servicesOffered: true,
  ownerName: true,
  phone: true,
  whatsapp: true,
  email: true,
  showEmail: true,
  websiteOrSocial: true,
  address: true,
  hideFullAddress: true,
  postcode: true,
  openingHours: true,
  specialNotes: true,
  otherAreaText: true,
  submittedAt: true,
  ownerEditedAt: true,
  category: { select: { name: true, status: true, requiresOwnerName: true } },
  subcategory: { select: { name: true } },
  zone: { select: { name: true } },
  servedZones: { select: { zone: { select: { slug: true } } } },
  localities: { select: { locality: { select: { slug: true } } } },
} satisfies Prisma.BusinessSelect;

type Detail = Prisma.BusinessGetPayload<{ select: typeof detailSelect }>;

function toDetail(b: Detail) {
  const { servedZones, localities, ...rest } = b;
  return { ...rest, serveZones: servedZones.map((z) => z.zone.slug), localities: localities.map((l) => l.locality.slug) };
}

const ownerListingsRoutes: FastifyPluginAsync = async (app) => {
  const auth = { preHandler: app.requireUser() };

  app.get("/listings", auth, async (req) => {
    const items = await app.prisma.business.findMany({
      where: { ownerUserId: req.user!.id },
      orderBy: { submittedAt: "desc" },
      take: 100,
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        verificationStatus: true,
        submittedAt: true,
        showEmail: true,
        category: { select: { name: true } }, // the name is shown even while the category is still waiting for review
      },
    });
    return { items };
  });

  app.get("/listings/:id", auth, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const found = await app.prisma.business.findFirst({ where: { id: p.data.id, ownerUserId: req.user!.id }, select: detailSelect });
    if (!found) return reply.code(404).send({ error: "Not found" });
    return { listing: toDetail(found) };
  });

  app.patch("/listings/:id", { ...auth, config: { rateLimit: { max: 30, timeWindow: "1 hour" } } }, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const body = editBody.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    const e = body.data;
    const current = await app.prisma.business.findFirst({ where: { id: p.data.id, ownerUserId: req.user!.id }, select: detailSelect });
    if (!current) return reply.code(404).send({ error: "Not found" });
    if (current.status !== "PENDING" && current.status !== "APPROVED") {
      return reply.code(409).send({ error: "This listing can no longer be edited. Please contact the BSD team." });
    }

    const errors: Record<string, string> = {};
    const data: Prisma.BusinessUncheckedUpdateInput = {};
    const clean = (v: string | null | undefined) => (v ? sanitizeText(v) || null : null);

    if (e.description !== undefined) {
      const description = sanitizeText(e.description);
      if (description !== current.description) {
        const problem = descriptionProblem(description);
        if (problem) errors.description = problem;
        data.description = description;
      }
    }
    if (e.servicesOffered !== undefined) {
      const services = sanitizeTextArray(e.servicesOffered);
      if (!services.length) errors.servicesOffered = "List at least one service.";
      data.servicesOffered = services;
    }
    const ownerName = e.ownerName !== undefined ? clean(e.ownerName) : current.ownerName;
    if (current.category.requiresOwnerName && !ownerName) errors.ownerName = "This category needs the owner or service provider name.";
    if (e.ownerName !== undefined) data.ownerName = ownerName;
    if (e.phone !== undefined) data.phone = e.phone;
    if (e.whatsapp !== undefined) data.whatsapp = e.whatsapp || null;
    if (e.email !== undefined) data.email = e.email || null;
    // The address is always kept for the BSD team. The switch only controls the public page, and needs an address to point at.
    const finalEmail = e.email !== undefined ? e.email || null : current.email;
    if (e.showEmail !== undefined) {
      if (e.showEmail && !finalEmail) errors.showEmail = "Add an email address before showing it publicly.";
      data.showEmail = e.showEmail;
    } else if (!finalEmail && current.showEmail) {
      data.showEmail = false; // removing the address also switches the flag off
    }
    for (const key of ["websiteOrSocial", "otherAreaText", "openingHours", "specialNotes"] as const) {
      if (e[key] !== undefined) data[key] = clean(e[key]);
    }
    if (e.address !== undefined) data.address = clean(e.address) ?? "HomeBased";
    if (e.hideFullAddress !== undefined) data.hideFullAddress = e.hideFullAddress;

    const zones = await app.prisma.coverageZone.findMany({ select: { id: true, slug: true } });
    let serveZoneIds: string[] | undefined;
    if (e.serveZones !== undefined) {
      serveZoneIds = e.serveZones.map((s) => zones.find((z) => z.slug === s)?.id).filter((x): x is string => Boolean(x));
      if (serveZoneIds.length !== new Set(e.serveZones).size) errors.serveZones = "Choose zones from the list.";
    }
    let localityIds: string[] | undefined;
    if (e.localities !== undefined) {
      const found = await app.prisma.locality.findMany({ where: { slug: { in: e.localities } }, select: { id: true } });
      if (found.length !== new Set(e.localities).size) errors.localities = "Choose areas from the list.";
      localityIds = found.map((l) => l.id);
    }
    const finalZones = e.serveZones ?? current.servedZones.map((z) => z.zone.slug);
    const finalLocalities = e.localities ?? current.localities.map((l) => l.locality.slug);
    const finalOther = e.otherAreaText !== undefined ? data.otherAreaText : current.otherAreaText;
    if (!finalZones.length && !finalLocalities.length && !finalOther) errors.serveZones = "Keep at least one area served.";

    if (Object.keys(errors).length) return reply.code(400).send({ error: "Please check the highlighted fields.", fieldErrors: errors });

    data.ownerEditedAt = new Date();
    await app.prisma.$transaction(async (tx) => {
      await tx.business.update({ where: { id: current.id }, data });
      if (serveZoneIds) {
        await tx.businessServedZone.deleteMany({ where: { businessId: current.id } });
        if (serveZoneIds.length) await tx.businessServedZone.createMany({ data: serveZoneIds.map((zoneId) => ({ businessId: current.id, zoneId })) });
      }
      if (localityIds) {
        await tx.businessLocality.deleteMany({ where: { businessId: current.id } });
        if (localityIds.length) await tx.businessLocality.createMany({ data: localityIds.map((localityId) => ({ businessId: current.id, localityId })) });
      }
    });
    const updated = await app.prisma.business.findUniqueOrThrow({ where: { id: current.id }, select: detailSelect });
    return { ok: true, listing: toDetail(updated) };
  });
};

export default ownerListingsRoutes;
