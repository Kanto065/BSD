import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sanitizeText, sanitizeTextArray } from "../../common/sanitize.js";
import { refreshListingGeoSoon } from "../../common/geocode.js";
import { idParams, invalid } from "../admin/admin.service.js";
import { ImageRejected, processImage } from "../../common/images.js";
import { MAX_PHOTOS, MAX_UPLOAD_BYTES, descriptionProblem, fieldRules, putProcessedImage } from "../businesses/businesses.submit.js";

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
  category: { select: { name: true, status: true, requiresOwnerName: true, serviceTags: true } },
  photos: { select: { id: true, url: true, thumbUrl: true, isLogo: true }, orderBy: { uploadedAt: "asc" as const } },
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
        // Counts that already exist in the database. No visit statistics are recorded anywhere.
        _count: { select: { photos: true, updateRequests: { where: { status: "PENDING" } }, claimRequests: { where: { status: "PENDING" } } } },
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
    // A changed address or hide switch re-decides the map point: cleared at once, looked up again only if the address is shown.
    if (data.address !== undefined || data.hideFullAddress !== undefined) await refreshListingGeoSoon(app.prisma, current.id);
    const updated = await app.prisma.business.findUniqueOrThrow({ where: { id: current.id }, select: detailSelect });
    return { ok: true, listing: toDetail(updated) };
  });

  // --- photos ------------------------------------------------------------------------------------------------
  // Same pipeline and public storage as Submit. One photo per request. The total is capped at the Submit limits
  // (one logo plus MAX_PHOTOS photos). Another owner's listing, or one that is not PENDING or APPROVED, is refused.

  const photoLimit = { rateLimit: { max: 30, timeWindow: "1 hour" } };
  const photoParams = z.object({ id: z.string().max(64), photoId: z.string().max(64) });

  async function editableListing(id: string, userId: string) {
    const b = await app.prisma.business.findFirst({ where: { id, ownerUserId: userId }, select: { id: true, status: true } });
    return b && (b.status === "PENDING" || b.status === "APPROVED") ? b : null;
  }
  const photoList = (businessId: string) =>
    app.prisma.businessPhoto.findMany({ where: { businessId }, select: { id: true, url: true, thumbUrl: true, isLogo: true }, orderBy: { uploadedAt: "asc" } });
  const touch = (businessId: string) => app.prisma.business.update({ where: { id: businessId }, data: { ownerEditedAt: new Date() } });

  app.post("/listings/:id/photos", { ...auth, config: photoLimit }, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const b = await editableListing(p.data.id, req.user!.id);
    if (!b) return reply.code(404).send({ error: "Not found" });
    const fail = (code: number, message: string) => reply.code(code).send({ error: message, fieldErrors: { photos: message } });
    if (!app.storage) return fail(503, "Image uploads are temporarily unavailable. Please try again later.");
    if (!req.isMultipart()) return fail(415, "The photo must be sent as multipart/form-data.");
    if ((await app.prisma.businessPhoto.count({ where: { businessId: b.id } })) >= MAX_PHOTOS + 1) {
      return fail(400, `A listing can have a logo and up to ${MAX_PHOTOS} photos. Remove one first.`);
    }

    let file: { buffer: Buffer; filename: string } | null = null;
    try {
      for await (const part of req.parts({ limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 3, fieldSize: 1_000, parts: 4 } })) {
        if (part.type === "file") {
          const buffer = await part.toBuffer(); // throws past the size limit
          if (!file && buffer.length) file = { buffer, filename: part.filename };
        }
      }
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "FST_REQ_FILE_TOO_LARGE") return fail(413, `Each image must be ${MAX_UPLOAD_BYTES / 1024 / 1024} MB or smaller.`);
      return fail(400, "We could not read that upload. Please try again.");
    }
    if (!file) return fail(400, "Choose a photo to upload.");

    let processed;
    try {
      processed = await processImage(file.buffer);
    } catch (err) {
      if (!(err instanceof ImageRejected)) throw err;
      return fail(400, `${file.filename || "An image"}: ${err.message}.`);
    }

    const stored: string[] = [];
    try {
      const row = await putProcessedImage(app.storage, `businesses/${randomUUID()}`, processed, stored);
      await app.prisma.$transaction([app.prisma.businessPhoto.create({ data: { ...row, businessId: b.id, isLogo: false } }), touch(b.id)]);
    } catch (err) {
      await Promise.allSettled(stored.map((k) => app.storage!.delete(k)));
      throw err;
    }
    return reply.code(201).send({ ok: true, photos: await photoList(b.id) });
  });

  app.delete("/listings/:id/photos/:photoId", { ...auth, config: photoLimit }, async (req, reply) => {
    const p = photoParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const b = await editableListing(p.data.id, req.user!.id);
    const photo = b && (await app.prisma.businessPhoto.findFirst({ where: { id: p.data.photoId, businessId: b.id } }));
    if (!b || !photo) return reply.code(404).send({ error: "Not found" });
    await app.prisma.$transaction([app.prisma.businessPhoto.delete({ where: { id: photo.id } }), touch(b.id)]);
    // The files go after the row, so a failure here leaves an unused file, never a broken image on a page.
    if (app.storage) {
      const keys = [photo.url, photo.thumbUrl].filter((u): u is string => Boolean(u)).map((u) => u.replace(/^\/uploads\//, ""));
      await Promise.allSettled(keys.map((k) => app.storage!.delete(k)));
    }
    return { ok: true, photos: await photoList(b.id) };
  });

  app.put("/listings/:id/logo/:photoId", { ...auth, config: photoLimit }, async (req, reply) => {
    const p = photoParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const b = await editableListing(p.data.id, req.user!.id);
    const photo = b && (await app.prisma.businessPhoto.findFirst({ where: { id: p.data.photoId, businessId: b.id }, select: { id: true } }));
    if (!b || !photo) return reply.code(404).send({ error: "Not found" });
    await app.prisma.$transaction([
      app.prisma.businessPhoto.updateMany({ where: { businessId: b.id, isLogo: true }, data: { isLogo: false } }),
      app.prisma.businessPhoto.update({ where: { id: photo.id }, data: { isLogo: true } }),
      touch(b.id),
    ]);
    return { ok: true, photos: await photoList(b.id) };
  });
};

export default ownerListingsRoutes;
