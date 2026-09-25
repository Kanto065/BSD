import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { rolesFrom } from "../../plugins/auth.js";
import { sanitizeText, sanitizeTextArray } from "../../common/sanitize.js";
import { checkCoverage } from "../../common/postcode.js";
import { countWords, fieldRules } from "../businesses/businesses.submit.js";
import { audit, diff, idParams, invalid, page, pageQuery, statusCounts } from "./admin.service.js";

// Moderation (MODERATOR and above) and community verification (VOLUNTEER and above).

const { text, optionalText, slug, phone } = fieldRules;
const STATUSES = ["PENDING", "APPROVED", "REJECTED", "REMOVED"] as const;
const VERIFICATION = ["NEWLY_LISTED", "PENDING_VERIFICATION", "COMMUNITY_VERIFIED"] as const;

const listQuery = pageQuery.extend({
  status: z.enum(STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
});

const rejectBody = z.object({ reason: z.string().trim().min(3, "Give a short reason (it is kept for the record).").max(500) });
const removeBody = z.object({ reason: z.string().trim().max(500).optional() }).optional();
const verificationBody = z.object({ status: z.enum(VERIFICATION) });

// Every field is optional: only what is sent changes. The rules match the public submission form.
const editBody = z
  .object({
    name: text(120).min(2, "Enter the business or service name."),
    category: slug,
    subcategory: z.union([slug, z.literal(""), z.null()]),
    description: text(2000).refine((v) => countWords(v) >= 50 && countWords(v) <= 150, {
      message: "The short description must be between 50 and 150 words.",
    }),
    servicesOffered: z.array(text(100)).min(1, "List at least one service.").max(15),
    ownerName: z.union([optionalText(120), z.null()]),
    phone,
    whatsapp: z.union([phone, z.literal(""), z.null()]),
    email: z.union([z.string().trim().max(200).email("Enter a valid email address."), z.literal(""), z.null()]),
    websiteOrSocial: z.union([optionalText(300), z.null()]),
    address: z.union([optionalText(300), z.null()]),
    postcode: text(12),
    serveZones: z.array(slug).max(3),
    localities: z.array(slug).max(60),
    otherAreaText: z.union([optionalText(300), z.null()]),
    openingHours: z.union([optionalText(500), z.null()]),
    specialNotes: z.union([optionalText(500), z.null()]),
  })
  .partial()
  .strict();

const detailInclude = {
  category: { select: { name: true, slug: true, requiresOwnerName: true } },
  subcategory: { select: { name: true, slug: true } },
  zone: { select: { name: true, slug: true } },
  servedZones: { select: { zone: { select: { name: true, slug: true } } } },
  localities: { select: { locality: { select: { name: true, slug: true } } } },
  photos: { orderBy: { uploadedAt: "asc" as const } },
  reviewedBy: { select: { name: true } },
  verifiedBy: { select: { name: true } },
} satisfies Prisma.BusinessInclude;

const listingsRoutes: FastifyPluginAsync = async (app) => {
  const moderator = { preHandler: app.requireRole(...rolesFrom("MODERATOR")) };
  const volunteer = { preHandler: app.requireRole(...rolesFrom("VOLUNTEER")) };

  app.get("/listings", moderator, async (req, reply) => {
    const q = listQuery.safeParse(req.query);
    if (!q.success) return invalid(reply, q.error);
    const where: Prisma.BusinessWhereInput = {
      ...(q.data.status ? { status: q.data.status } : {}),
      ...(q.data.q
        ? {
            OR: [
              { name: { contains: q.data.q, mode: "insensitive" } },
              { slug: { contains: q.data.q.toLowerCase() } },
              { postcode: { contains: q.data.q.toUpperCase() } },
              { phone: { contains: q.data.q } },
              { email: { contains: q.data.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [total, items] = await app.prisma.$transaction([
      app.prisma.business.count({ where }),
      app.prisma.business.findMany({
        where,
        // Oldest pending first, so nothing waits too long; otherwise newest first.
        orderBy: q.data.status === "PENDING" ? { submittedAt: "asc" } : { submittedAt: "desc" },
        ...page(q.data),
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          verificationStatus: true,
          postcode: true,
          phone: true,
          submittedAt: true,
          reviewedAt: true,
          category: { select: { name: true } },
          zone: { select: { name: true, slug: true } },
          _count: { select: { photos: true } },
        },
      }),
    ]);
    return {
      items,
      total,
      page: q.data.page,
      pageSize: q.data.pageSize,
      counts: await statusCounts(app.prisma),
    };
  });

  app.get("/listings/:id", moderator, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const listing = await app.prisma.business.findUnique({ where: { id: p.data.id }, include: detailInclude });
    if (!listing) return reply.code(404).send({ error: "Not found" });
    const history = await app.prisma.auditLog.findMany({
      where: { entityType: "Business", entityId: listing.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { admin: { select: { name: true } } },
    });
    return { listing, history };
  });

  // --- moderation -----------------------------------------------------------------------------------------------

  app.patch("/listings/:id/approve", moderator, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const found = await app.prisma.business.findUnique({ where: { id: p.data.id }, select: { status: true } });
    if (!found) return reply.code(404).send({ error: "Not found" });
    if (found.status === "APPROVED") return reply.code(409).send({ error: "This listing is already approved." });
    await app.prisma.$transaction([
      app.prisma.business.update({
        where: { id: p.data.id },
        data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: req.admin!.id, rejectionReason: null },
      }),
      audit(app.prisma, req.admin!.id, "APPROVE_LISTING", "Business", p.data.id, { from: found.status }),
    ]);
    return { ok: true, status: "APPROVED" };
  });

  app.patch("/listings/:id/reject", moderator, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const body = rejectBody.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    const found = await app.prisma.business.findUnique({ where: { id: p.data.id }, select: { status: true } });
    if (!found) return reply.code(404).send({ error: "Not found" });
    const reason = sanitizeText(body.data.reason);
    await app.prisma.$transaction([
      app.prisma.business.update({
        where: { id: p.data.id },
        data: { status: "REJECTED", reviewedAt: new Date(), reviewedById: req.admin!.id, rejectionReason: reason },
      }),
      audit(app.prisma, req.admin!.id, "REJECT_LISTING", "Business", p.data.id, { from: found.status, reason }),
    ]);
    return { ok: true, status: "REJECTED" };
  });

  // Soft delete: a listing is never hard-deleted, so the record and its history remain.
  app.delete("/listings/:id", moderator, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const body = removeBody.safeParse(req.body ?? undefined);
    if (!body.success) return invalid(reply, body.error);
    const found = await app.prisma.business.findUnique({ where: { id: p.data.id }, select: { status: true } });
    if (!found) return reply.code(404).send({ error: "Not found" });
    const reason = body.data?.reason ? sanitizeText(body.data.reason) : undefined;
    await app.prisma.$transaction([
      app.prisma.business.update({ where: { id: p.data.id }, data: { status: "REMOVED", reviewedAt: new Date(), reviewedById: req.admin!.id } }),
      audit(app.prisma, req.admin!.id, "REMOVE_LISTING", "Business", p.data.id, { from: found.status, ...(reason ? { reason } : {}) }),
    ]);
    return { ok: true, status: "REMOVED" };
  });

  app.patch("/listings/:id", moderator, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const body = editBody.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    const e = body.data;
    const current = await app.prisma.business.findUnique({ where: { id: p.data.id }, include: detailInclude });
    if (!current) return reply.code(404).send({ error: "Not found" });

    const errors: Record<string, string> = {};
    const data: Prisma.BusinessUncheckedUpdateInput = {};
    const clean = (v: string | null | undefined) => (v ? sanitizeText(v) || null : null);

    // Category and subcategory stay consistent: a new category drops a subcategory that does not belong to it.
    let categoryId = current.categoryId;
    let requiresOwnerName = current.category.requiresOwnerName;
    if (e.category !== undefined) {
      const cat = await app.prisma.category.findUnique({ where: { slug: e.category } });
      if (!cat) errors.category = "Choose a category from the list.";
      else {
        categoryId = cat.id;
        requiresOwnerName = cat.requiresOwnerName;
        data.categoryId = cat.id;
      }
    }
    if (e.subcategory !== undefined || e.category !== undefined) {
      const wanted = e.subcategory !== undefined ? e.subcategory : current.subcategory?.slug ?? null;
      if (!wanted) data.subcategoryId = null;
      else {
        const sub = await app.prisma.subcategory.findFirst({ where: { slug: wanted, categoryId } });
        if (sub) data.subcategoryId = sub.id;
        else if (e.subcategory) errors.subcategory = "Choose a subcategory that belongs to the chosen category.";
        else data.subcategoryId = null; // the old subcategory does not belong to the new category
      }
    }
    const ownerName = e.ownerName !== undefined ? clean(e.ownerName) : current.ownerName;
    if (requiresOwnerName && !ownerName) errors.ownerName = "This category needs the owner or service provider name.";
    if (e.ownerName !== undefined) data.ownerName = ownerName;

    if (e.name !== undefined) {
      const name = sanitizeText(e.name);
      if (name.length < 2) errors.name = "Enter the business or service name.";
      data.name = name;
    }
    if (e.description !== undefined) {
      const description = sanitizeText(e.description);
      if (countWords(description) < 50 || countWords(description) > 150) errors.description = "The short description must be between 50 and 150 words.";
      data.description = description;
    }
    if (e.servicesOffered !== undefined) {
      const services = sanitizeTextArray(e.servicesOffered);
      if (!services.length) errors.servicesOffered = "List at least one service.";
      data.servicesOffered = services;
    }
    if (e.phone !== undefined) data.phone = e.phone;
    if (e.whatsapp !== undefined) data.whatsapp = e.whatsapp || null;
    if (e.email !== undefined) data.email = e.email || null;
    for (const key of ["websiteOrSocial", "otherAreaText", "openingHours", "specialNotes"] as const) {
      if (e[key] !== undefined) data[key] = clean(e[key]);
    }
    if (e.address !== undefined) data.address = clean(e.address) ?? "HomeBased";

    const zones = await app.prisma.coverageZone.findMany({ select: { id: true, slug: true, postcodeDistricts: true } });
    if (e.postcode !== undefined) {
      const coverage = checkCoverage(e.postcode, zones);
      if (!coverage.ok) errors.postcode = coverage.message;
      else {
        data.postcode = coverage.postcode;
        data.postcodeDistrict = coverage.outward;
        data.zoneId = coverage.zone.id;
      }
    }
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
    const finalZones = serveZoneIds ?? current.servedZones.map((z) => z.zone.slug);
    const finalLocalities = localityIds ?? current.localities.map((l) => l.locality.slug);
    const finalOther = e.otherAreaText !== undefined ? data.otherAreaText : current.otherAreaText;
    if (!finalZones.length && !finalLocalities.length && !finalOther) errors.serveZones = "Keep at least one area served.";

    if (Object.keys(errors).length) return reply.code(400).send({ error: "Please check the highlighted fields.", fieldErrors: errors });

    const before: Record<string, unknown> = {
      ...Object.fromEntries(Object.keys(data).map((k) => [k, (current as Record<string, unknown>)[k]])),
      ...(serveZoneIds ? { serveZones: current.servedZones.map((z) => z.zone.slug) } : {}),
      ...(localityIds ? { localities: current.localities.map((l) => l.locality.slug) } : {}),
    };
    const after: Record<string, unknown> = { ...data, ...(serveZoneIds ? { serveZones: e.serveZones } : {}), ...(localityIds ? { localities: e.localities } : {}) };
    const changes = diff(before, after);
    if (!Object.keys(changes).length) return { ok: true, changed: [] };

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
      await audit(tx, req.admin!.id, "EDIT_LISTING", "Business", current.id, changes as Prisma.InputJsonValue);
    });
    return { ok: true, changed: Object.keys(changes) };
  });

  app.delete("/listings/:id/photos/:photoId", moderator, async (req, reply) => {
    const p = z.object({ id: z.string().max(64), photoId: z.string().max(64) }).safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const photo = await app.prisma.businessPhoto.findFirst({ where: { id: p.data.photoId, businessId: p.data.id } });
    if (!photo) return reply.code(404).send({ error: "Not found" });
    await app.prisma.$transaction([
      app.prisma.businessPhoto.delete({ where: { id: photo.id } }),
      audit(app.prisma, req.admin!.id, "REMOVE_PHOTO", "Business", p.data.id, { url: photo.url, isLogo: photo.isLogo }),
    ]);
    // The files go after the row, so a failure here leaves an unused file, never a broken image on a page.
    if (app.storage) {
      const keys = [photo.url, photo.thumbUrl].filter((u): u is string => Boolean(u)).map((u) => u.replace(/^\/uploads\//, ""));
      await Promise.allSettled(keys.map((k) => app.storage!.delete(k)));
    }
    return { ok: true };
  });

  // --- community verification (field volunteers) --------------------------------------------------------------

  // Approved listings that are not yet Community Verified, oldest approval first, with what a volunteer needs to check.
  app.get("/verification-queue", volunteer, async (req, reply) => {
    const q = pageQuery.safeParse(req.query);
    if (!q.success) return invalid(reply, q.error);
    const where: Prisma.BusinessWhereInput = { status: "APPROVED", verificationStatus: { not: "COMMUNITY_VERIFIED" } };
    const [total, items] = await app.prisma.$transaction([
      app.prisma.business.count({ where }),
      app.prisma.business.findMany({
        where,
        orderBy: [{ reviewedAt: "asc" }, { submittedAt: "asc" }],
        ...page(q.data),
        select: {
          id: true,
          slug: true,
          name: true,
          verificationStatus: true,
          phone: true,
          whatsapp: true,
          address: true,
          postcode: true,
          openingHours: true,
          reviewedAt: true,
          category: { select: { name: true } },
          zone: { select: { name: true } },
          localities: { select: { locality: { select: { name: true } } } },
        },
      }),
    ]);
    return { items, total, page: q.data.page, pageSize: q.data.pageSize };
  });

  app.patch("/listings/:id/verification", volunteer, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const body = verificationBody.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    const found = await app.prisma.business.findUnique({ where: { id: p.data.id }, select: { status: true, verificationStatus: true } });
    if (!found) return reply.code(404).send({ error: "Not found" });
    if (found.status !== "APPROVED") return reply.code(409).send({ error: "Only approved listings can be verified." });
    const verified = body.data.status === "COMMUNITY_VERIFIED";
    await app.prisma.$transaction([
      app.prisma.business.update({
        where: { id: p.data.id },
        data: {
          verificationStatus: body.data.status,
          // Recorded when a listing becomes Community Verified, cleared if it is downgraded.
          verifiedAt: verified ? new Date() : null,
          verifiedById: verified ? req.admin!.id : null,
        },
      }),
      audit(app.prisma, req.admin!.id, "SET_VERIFICATION", "Business", p.data.id, { from: found.verificationStatus, to: body.data.status }),
    ]);
    return { ok: true, verificationStatus: body.data.status };
  });
};

export default listingsRoutes;
