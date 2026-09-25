import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { sanitizeText, sanitizeTextArray } from "../../common/sanitize.js";
import { checkCoverage } from "../../common/postcode.js";
import { ImageRejected, processImage, type ProcessedImage } from "../../common/images.js";
import { publicUrl, type ObjectStorage } from "../../common/storage.js";
import { slugify } from "../../common/slug.js";

// Public submission of a new listing, per the client's Submission Form doc with the v2 changes: a required postcode
// that decides the zone, an optional WhatsApp number, and "Areas you serve" (zones, localities and free text) in place
// of the old town checklist. A new listing is PENDING (moderation) and NEWLY_LISTED (verification), so it is never
// public until an admin approves it.

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // per file, before compression
export const MAX_PHOTOS = 4;

export const UPLOAD_LIMITS = {
  fileSize: MAX_UPLOAD_BYTES,
  files: MAX_PHOTOS + 1, // one logo plus the photos
  fields: 120,
  fieldSize: 5_000,
  parts: 130,
};

export type FieldErrors = Record<string, string>;

export class SubmissionError extends Error {
  constructor(
    public readonly status: number,
    public readonly fieldErrors: FieldErrors,
    message = "Please check the highlighted fields."
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Reading the multipart request
// ---------------------------------------------------------------------------

type RawSubmission = { fields: Map<string, string[]>; files: { field: "logo" | "photos"; filename: string; buffer: Buffer }[] };

export async function readSubmission(req: FastifyRequest): Promise<RawSubmission> {
  if (!req.isMultipart()) throw new SubmissionError(415, { form: "The form must be sent as multipart/form-data." });
  const fields = new Map<string, string[]>();
  const files: RawSubmission["files"] = [];
  try {
    for await (const part of req.parts()) {
      if (part.type === "file") {
        const file = part as MultipartFile;
        if (file.fieldname !== "logo" && file.fieldname !== "photos") {
          await file.toBuffer(); // drain and ignore unexpected files
          continue;
        }
        const buffer = await file.toBuffer();
        if (buffer.length === 0) continue; // an empty file input
        files.push({ field: file.fieldname, filename: file.filename, buffer });
      } else {
        const list = fields.get(part.fieldname) ?? [];
        list.push(String(part.value ?? ""));
        fields.set(part.fieldname, list);
      }
    }
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "FST_REQ_FILE_TOO_LARGE") {
      throw new SubmissionError(413, { photos: `Each image must be ${MAX_UPLOAD_BYTES / 1024 / 1024} MB or smaller.` });
    }
    if (code === "FST_FILES_LIMIT") throw new SubmissionError(400, { photos: `Upload one logo and up to ${MAX_PHOTOS} photos.` });
    if (code === "FST_PARTS_LIMIT" || code === "FST_FIELDS_LIMIT") throw new SubmissionError(400, { form: "Too many fields were sent." });
    throw err;
  }
  if (files.filter((f) => f.field === "logo").length > 1) throw new SubmissionError(400, { logo: "Upload a single logo." });
  if (files.filter((f) => f.field === "photos").length > MAX_PHOTOS) {
    throw new SubmissionError(400, { photos: `Upload up to ${MAX_PHOTOS} photos.` });
  }
  return { fields, files };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const text = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`);
const optionalText = (max: number) => text(max).optional().transform((v) => (v ? v : undefined));
const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,100}$/, "Choose an option from the list.");
const phone = z
  .string()
  .trim()
  .max(25)
  .refine((v) => /^[+()\d\s-]+$/.test(v) && v.replace(/\D/g, "").length >= 10 && v.replace(/\D/g, "").length <= 15, {
    message: "Enter a valid phone number.",
  });
const accepted = z
  .string()
  .optional()
  .refine((v) => v === "true" || v === "on" || v === "yes", { message: "Please tick this box to continue." });

export const countWords = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** The field rules, shared with the admin edit form so a listing always meets the same standard. */
export const fieldRules = { text, optionalText, slug, phone };

export const submissionSchema = z.object({
  name: text(120).min(2, "Enter the business or service name."),
  category: slug,
  subcategory: slug.optional().or(z.literal("")).transform((v) => v || undefined),
  description: text(2000).refine((v) => countWords(v) >= 50 && countWords(v) <= 150, {
    message: "The short description must be between 50 and 150 words.",
  }),
  servicesOffered: z
    .array(text(100))
    .transform((a) => a.filter(Boolean))
    .refine((a) => a.length >= 1, { message: "List at least one service." })
    .refine((a) => a.length <= 15, { message: "List up to 15 services." }),
  ownerName: optionalText(120),
  phone,
  whatsapp: phone.optional().or(z.literal("")).transform((v) => v || undefined),
  email: z.string().trim().max(200).email("Enter a valid email address.").optional().or(z.literal("")).transform((v) => v || undefined),
  websiteOrSocial: optionalText(300),
  address: optionalText(300),
  postcode: text(12).min(1, "Enter the postcode."),
  serveZones: z.array(slug).max(3),
  localities: z.array(slug).max(60),
  otherAreaText: optionalText(300),
  openingHours: optionalText(500),
  specialNotes: optionalText(500),
  consentAccurateInfo: accepted,
  consentPublishPermission: accepted,
  consentNoLiability: accepted,
  consentDataStorage: accepted,
  gdprConsentStorage: accepted,
  gdprConsentRights: accepted,
});

export type Submission = z.infer<typeof submissionSchema>;

const ARRAY_FIELDS = new Set(["servicesOffered", "serveZones", "localities"]);

/** Checks the fields on their own. Database checks (category, postcode, areas) come after. */
export function parseFields(fields: Map<string, string[]>): Submission {
  const input: Record<string, unknown> = {};
  for (const key of Object.keys(submissionSchema.shape)) {
    const values = fields.get(key) ?? [];
    input[key] = ARRAY_FIELDS.has(key) ? values : values[0];
  }
  const result = submissionSchema.safeParse(input);
  if (!result.success) {
    const errors: FieldErrors = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!errors[key]) errors[key] = key === "name" && issue.code === "invalid_type" ? "Enter the business or service name." : issue.message;
    }
    for (const [key, message] of Object.entries(errors)) {
      if (message === "Required" || message.startsWith("Expected")) errors[key] = "This field is required.";
    }
    throw new SubmissionError(400, errors);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------

/** "Honeypot" field hidden from people. Bots that fill every field get a normal-looking reply and nothing is saved. */
export const HONEYPOT_FIELD = "companyWebsite";

async function uniqueSlug(prisma: PrismaClient, name: string, district: string): Promise<string> {
  const base = `${slugify(name).slice(0, 60).replace(/-$/, "") || "listing"}-${district.toLowerCase()}`;
  let candidate = base;
  for (let i = 0; i < 6; i++) {
    if (!(await prisma.business.findUnique({ where: { slug: candidate }, select: { id: true } }))) return candidate;
    candidate = `${base}-${randomBytes(2).toString("hex")}`;
  }
  return `${base}-${randomUUID().slice(0, 8)}`;
}

export type SubmitResult = { slug: string; photos: number };

export async function saveSubmission(
  prisma: PrismaClient,
  storage: ObjectStorage | null,
  raw: RawSubmission
): Promise<SubmitResult> {
  const s = parseFields(raw.fields);
  const errors: FieldErrors = {};

  // Category and subcategory, looked up by slug. Whether an owner name is needed comes from the category row.
  const category = await prisma.category.findUnique({ where: { slug: s.category }, select: { id: true, requiresOwnerName: true } });
  if (!category) errors.category = "Choose a category from the list.";
  let subcategoryId: string | undefined;
  if (category && s.subcategory) {
    const sub = await prisma.subcategory.findFirst({ where: { slug: s.subcategory, categoryId: category.id }, select: { id: true } });
    if (!sub) errors.subcategory = "Choose a subcategory that belongs to the chosen category.";
    else subcategoryId = sub.id;
  }
  if (category?.requiresOwnerName && !s.ownerName) {
    errors.ownerName = "Independent Professionals must give the owner or service provider name.";
  }

  // The postcode decides the zone. The submitter never picks it.
  const zones = await prisma.coverageZone.findMany({ select: { id: true, slug: true, postcodeDistricts: true } });
  const coverage = checkCoverage(s.postcode, zones);
  if (!coverage.ok) errors.postcode = coverage.message;

  // Areas you serve: at least one zone, locality or free-text area, as on the v1 form.
  const serveZoneIds = s.serveZones.map((slug) => zones.find((z) => z.slug === slug)?.id);
  if (serveZoneIds.some((id) => !id)) errors.serveZones = "Choose zones from the list.";
  const localities = s.localities.length
    ? await prisma.locality.findMany({ where: { slug: { in: s.localities } }, select: { id: true, slug: true } })
    : [];
  if (localities.length !== new Set(s.localities).size) errors.localities = "Choose areas from the list.";
  const otherAreaText = s.otherAreaText ? sanitizeText(s.otherAreaText) : undefined;
  if (!s.serveZones.length && !s.localities.length && !otherAreaText) {
    errors.serveZones = "Choose at least one area you serve, or describe it under Others.";
  }

  // Images: checked and compressed before anything is stored.
  const images: { isLogo: boolean; processed: ProcessedImage }[] = [];
  for (const file of raw.files) {
    try {
      images.push({ isLogo: file.field === "logo", processed: await processImage(file.buffer) });
    } catch (err) {
      if (!(err instanceof ImageRejected)) throw err;
      errors[file.field] = `${file.filename || "An image"}: ${err.message}.`;
    }
  }
  if (images.length && !storage) {
    throw new SubmissionError(503, { photos: "Image uploads are temporarily unavailable. Please submit without images or try later." });
  }

  if (Object.keys(errors).length) throw new SubmissionError(400, errors);
  if (!coverage.ok || !category) throw new Error("unreachable");

  // Clean every free-text field before it touches the database.
  const description = sanitizeText(s.description);
  const servicesOffered = sanitizeTextArray(s.servicesOffered);
  const name = sanitizeText(s.name);
  const afterClean: FieldErrors = {};
  if (name.length < 2) afterClean.name = "Enter the business or service name.";
  if (countWords(description) < 50) afterClean.description = "The short description must be between 50 and 150 words.";
  if (!servicesOffered.length) afterClean.servicesOffered = "List at least one service.";
  if (Object.keys(afterClean).length) throw new SubmissionError(400, afterClean);

  // Store the images, then the listing. If saving the listing fails, the stored images are removed again.
  const folder = `businesses/${randomUUID()}`;
  const stored: string[] = [];
  const photoRows: {
    url: string;
    thumbUrl: string | null;
    mimeType: string;
    sizeBytes: number;
    width: number;
    height: number;
    isLogo: boolean;
  }[] = [];
  try {
    for (const { isLogo, processed } of images) {
      const id = randomUUID();
      const key = `${folder}/${id}.${processed.master.ext}`;
      await storage!.put({ key, body: processed.master.buffer, contentType: processed.master.contentType });
      stored.push(key);
      let thumbUrl: string | null = null;
      if (processed.thumb) {
        const thumbKey = `${folder}/${id}-thumb.webp`;
        await storage!.put({ key: thumbKey, body: processed.thumb.buffer, contentType: processed.thumb.contentType });
        stored.push(thumbKey);
        thumbUrl = publicUrl(thumbKey);
      }
      photoRows.push({
        url: publicUrl(key),
        thumbUrl,
        mimeType: processed.master.contentType,
        sizeBytes: processed.master.buffer.length,
        width: processed.master.width,
        height: processed.master.height,
        isLogo,
      });
    }

    const slugValue = await uniqueSlug(prisma, name, coverage.outward);
    await prisma.business.create({
      data: {
        slug: slugValue,
        name,
        categoryId: category.id,
        subcategoryId,
        description,
        servicesOffered,
        ownerName: s.ownerName ? sanitizeText(s.ownerName) : null,
        phone: s.phone,
        whatsapp: s.whatsapp ?? null,
        email: s.email ?? null,
        websiteOrSocial: s.websiteOrSocial ? sanitizeText(s.websiteOrSocial) : null,
        address: s.address ? sanitizeText(s.address) : "HomeBased",
        postcode: coverage.postcode,
        postcodeDistrict: coverage.outward,
        zoneId: coverage.zone.id,
        otherAreaText: otherAreaText ?? null,
        openingHours: s.openingHours ? sanitizeText(s.openingHours) : null,
        specialNotes: s.specialNotes ? sanitizeText(s.specialNotes) : null,
        status: "PENDING",
        verificationStatus: "NEWLY_LISTED",
        consentAccurateInfo: true,
        consentPublishPermission: true,
        consentNoLiability: true,
        consentDataStorage: true,
        gdprConsentStorage: true,
        gdprConsentRights: true,
        servedZones: { create: serveZoneIds.map((zoneId) => ({ zoneId: zoneId! })) },
        localities: { create: localities.map((l) => ({ localityId: l.id })) },
        photos: { create: photoRows },
      },
    });
    return { slug: slugValue, photos: photoRows.length };
  } catch (err) {
    await Promise.allSettled(stored.map((key) => storage!.delete(key)));
    throw err;
  }
}
