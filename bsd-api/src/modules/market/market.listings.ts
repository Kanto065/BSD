import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { sanitizeText } from "../../common/sanitize.js";
import { checkCoverage } from "../../common/postcode.js";
import { slugify } from "../../common/slug.js";
import { ImageRejected } from "../../common/images.js";
import { MARKET_MAX_IMAGES, processMarketImage, type MarketImageResult } from "../../common/market-images.js";
import { publicUrl, type ObjectStorage } from "../../common/storage.js";
import { MAX_UPLOAD_BYTES, fieldRules, type FieldErrors } from "../businesses/businesses.submit.js";

// Marketplace listings (M12-A): validation, saving and the one place that decides what the public may see.
//
// Address rule (same intent as the directory's hidesAddress): a listing has only a postcode, never a street. When
// hideFullAddress is true the full postcode never appears in any public body, only the district ("SA5").

export const MAX_NEW_PER_DAY = 5;
export const REVIEWED_FIRST_LISTINGS = 2; // Q-M12-1: a new account's first listings are held for review
export const LISTING_DAYS = 30;
export const LEGAL_TEXT = "I agree that BayConnect is a neutral platform and holds no liability for transactions, payments, item condition, quality, or returns.";
const DAY = 24 * 60 * 60_000;

export class MarketError extends Error {
  constructor(public readonly status: number, public readonly fieldErrors: FieldErrors, message = "Please check the highlighted fields.") {
    super(message);
  }
}

// ====================
// Public shapes
// ====================

const imageSelect = { select: { key: true, thumbKey: true, width: true, height: true }, orderBy: { sortOrder: "asc" } } as const;
const listSelect = {
  slug: true, title: true, kind: true, isB2B: true, pricePence: true, negotiable: true, condition: true,
  postcode: true, postcodeDistrict: true, hideFullAddress: true, bumpedAt: true, createdAt: true,
  category: { select: { name: true, slug: true } },
  directoryBusiness: { select: { name: true, slug: true } },
  images: { ...imageSelect, take: 1 },
} satisfies Prisma.MarketListingSelect;
const detailSelect = {
  ...listSelect,
  description: true, whatsapp: true, offerPassDiscount: true, passDiscountNote: true, vatInvoice: true, bulkTerms: true, status: true,
  spot: { select: { name: true, address: true, postcodeDistrict: true } },
  images: imageSelect,
} satisfies Prisma.MarketListingSelect;
const mineSelect = {
  ...detailSelect,
  id: true, phone: true, removalReason: true, reportCount: true, expiresAt: true,
} satisfies Prisma.MarketListingSelect;

type Row = Prisma.MarketListingGetPayload<{ select: typeof listSelect }>;
type DetailRow = Prisma.MarketListingGetPayload<{ select: typeof detailSelect }>;
type MineRow = Prisma.MarketListingGetPayload<{ select: typeof mineSelect }>;

const img = (i: { key: string; thumbKey: string; width: number; height: number }) => ({ url: publicUrl(i.key), thumbUrl: publicUrl(i.thumbKey), width: i.width, height: i.height });

/** What every public body says about where the item is. The full postcode is present only when the seller allowed it. */
function place(r: { postcode: string; postcodeDistrict: string; hideFullAddress: boolean }) {
  return {
    postcodeDistrict: r.postcodeDistrict,
    postcode: r.hideFullAddress ? null : r.postcode,
    areaLabel: r.hideFullAddress ? `Location: ${r.postcodeDistrict}` : null,
  };
}

export function toListItem(r: Row) {
  return {
    slug: r.slug, title: r.title, kind: r.kind, isB2B: r.isB2B, free: r.kind === "GIVEAWAY",
    pricePence: r.pricePence, negotiable: r.negotiable, condition: r.condition,
    category: r.category, ...place(r), hideFullAddress: r.hideFullAddress,
    verifiedBusiness: r.directoryBusiness, bumpedAt: r.bumpedAt, createdAt: r.createdAt,
    image: r.images[0] ? img(r.images[0]) : null,
  };
}

export function toDetail(r: DetailRow) {
  const { image: _i, ...base } = toListItem(r);
  return {
    ...base, status: r.status, description: r.description, whatsapp: r.whatsapp,
    offerPassDiscount: r.offerPassDiscount, passDiscountNote: r.passDiscountNote, vatInvoice: r.vatInvoice, bulkTerms: r.bulkTerms,
    spot: r.spot, images: r.images.map(img),
  };
}

/** The owner sees their own full postcode and phone, plus status and the removal reason. */
export function toMine(r: MineRow) {
  const { id, phone, removalReason, reportCount, expiresAt, postcode } = r;
  return { ...toDetail(r), id, phone, removalReason, reportCount, expiresAt, postcode };
}

export const SELECTS = { listSelect, detailSelect, mineSelect };

/** Public visibility: live (not expired), by an account that still exists, in a category that is not staged. */
export function publicWhere(extra: Prisma.MarketListingWhereInput = {}, now = new Date()): Prisma.MarketListingWhereInput {
  return { AND: [{ expiresAt: { gt: now } }, { owner: { deletedAt: null } }, { category: { staged: false } }, extra] };
}

// ====================
// Reading and validating a request
// ====================

export async function readMultipart(req: FastifyRequest): Promise<{ fields: Record<string, string>; files: { filename: string; buffer: Buffer }[] }> {
  if (!req.isMultipart()) throw new MarketError(415, { form: "The form must be sent as multipart/form-data." });
  const fields: Record<string, string> = {};
  const files: { filename: string; buffer: Buffer }[] = [];
  try {
    for await (const part of req.parts()) {
      if (part.type === "file") {
        const f = part as MultipartFile;
        const buffer = await f.toBuffer();
        if (f.fieldname === "images" && buffer.length) files.push({ filename: f.filename, buffer });
      } else if (!(part.fieldname in fields)) fields[part.fieldname] = String(part.value ?? "");
    }
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "FST_REQ_FILE_TOO_LARGE") throw new MarketError(413, { images: `Each image must be ${MAX_UPLOAD_BYTES / 1024 / 1024} MB or smaller.` });
    if (code === "FST_FILES_LIMIT") throw new MarketError(400, { images: `Upload up to ${MARKET_MAX_IMAGES} images.` });
    if (code === "FST_PARTS_LIMIT" || code === "FST_FIELDS_LIMIT") throw new MarketError(400, { form: "Too many fields were sent." });
    throw err;
  }
  return { fields, files };
}

const text = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`);
const bool = z.string().optional().transform((v) => v?.trim().toLowerCase() === "true");
const optional = <T extends z.ZodTypeAny>(t: T) => t.optional().or(z.literal("")).transform((v) => (v === "" ? undefined : (v as z.infer<T> | undefined)));
const pounds = z
  .string()
  .trim()
  .regex(/^\d{1,7}(\.\d{1,2})?$/, "Enter a price in pounds, for example 12.50.")
  .transform((v) => Math.round(parseFloat(v) * 100))
  .refine((p) => p <= 100_000_000, "The price can be at most 1,000,000 pounds.");
const CONDITIONS = ["BRAND_NEW", "LIKE_NEW", "USED_GOOD", "FOR_PARTS"] as const;
const KINDS = ["SELL", "BUY", "GIVEAWAY", "SERVICE"] as const;

const createSchema = z.object({
  kind: z.enum(KINDS, { errorMap: () => ({ message: "Choose what you are posting." }) }),
  isB2B: bool,
  title: text(120),
  description: text(2000),
  price: z.union([pounds, z.literal("")]).optional().transform((v) => (v === "" ? undefined : v)),
  negotiable: bool,
  condition: z.union([z.enum(CONDITIONS, { errorMap: () => ({ message: "Choose a condition from the list." }) }), z.literal("")]).optional().transform((v) => (v === "" ? undefined : v)),
  category: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,100}$/, "Choose a category from the list."),
  postcode: text(12).min(1, "Enter the postcode."),
  hideFullAddress: z.string().optional().transform((v) => (v === undefined || v === "" ? undefined : v.trim().toLowerCase() === "true")),
  spotId: optional(text(64)),
  whatsapp: fieldRules.phone,
  phone: optional(fieldRules.phone),
  offerPassDiscount: bool,
  passDiscountNote: optional(text(200)),
  vatInvoice: bool,
  bulkTerms: optional(text(500)),
  legalAcknowledged: z.string().optional().refine((v) => v?.trim().toLowerCase() === "true", { message: "Please tick this box to continue." }),
});

function zodErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const i of error.issues) {
    const k = String(i.path[0] ?? "form");
    if (!out[k]) out[k] = i.message === "Required" || i.message.startsWith("Expected") ? "This field is required." : i.message;
  }
  return out;
}

async function checkSpot(prisma: PrismaClient, spotId: string | undefined, errors: FieldErrors) {
  if (!spotId) return null;
  const spot = await prisma.safeSpot.findFirst({ where: { id: spotId, active: true }, select: { id: true } });
  if (!spot) errors.spotId = "Choose a meeting place from the list.";
  return spot?.id ?? null;
}

async function uniqueSlug(prisma: PrismaClient, title: string) {
  const base = slugify(title).slice(0, 60).replace(/-$/, "") || "listing";
  for (let i = 0; i < 5; i++) {
    const candidate = `${base}-${randomBytes(3).toString("hex")}`;
    if (!(await prisma.marketListing.findUnique({ where: { slug: candidate }, select: { id: true } }))) return candidate;
  }
  return `${base}-${randomUUID().slice(0, 8)}`;
}

// ====================
// Create
// ====================

export async function createListing(
  prisma: PrismaClient,
  storage: ObjectStorage | null,
  userId: string,
  raw: { fields: Record<string, string>; files: { filename: string; buffer: Buffer }[] }
) {
  const parsed = createSchema.safeParse(raw.fields);
  if (!parsed.success) throw new MarketError(400, zodErrors(parsed.error));
  const s = parsed.data;
  const errors: FieldErrors = {};

  const category = await prisma.marketCategory.findFirst({ where: { slug: s.category, staged: false }, select: { id: true } });
  if (!category) errors.category = "Choose a category from the list.";
  const zones = await prisma.coverageZone.findMany({ select: { postcodeDistricts: true } });
  const coverage = checkCoverage(s.postcode, zones);
  if (!coverage.ok) errors.postcode = coverage.message;
  const spotId = await checkSpot(prisma, s.spotId, errors);

  if (!s.isB2B && (s.vatInvoice || s.bulkTerms)) errors.isB2B = "VAT invoice and bulk terms are only for business listings.";
  if (s.kind === "SELL" && s.price === undefined) errors.price = "Enter a price.";
  const pricePence = s.kind === "GIVEAWAY" ? null : (s.price ?? null);

  const title = sanitizeText(s.title);
  const description = sanitizeText(s.description);
  if (title.length < 5) errors.title = "The title must be at least 5 characters.";
  if (description.length < 20) errors.description = "The description must be at least 20 characters.";

  const processed: MarketImageResult[] = [];
  for (const f of raw.files.slice(0, MARKET_MAX_IMAGES)) {
    try {
      processed.push(await processMarketImage(f.buffer));
    } catch (err) {
      if (!(err instanceof ImageRejected)) throw err;
      errors.images = `${f.filename || "An image"}: ${err.message}.`;
    }
  }
  if (processed.length && !storage) throw new MarketError(503, { images: "Image uploads are temporarily unavailable. Please post without images or try later." });
  if (Object.keys(errors).length) throw new MarketError(400, errors);
  if (!coverage.ok || !category) throw new Error("unreachable");

  const now = new Date();
  if ((await prisma.marketListing.count({ where: { ownerUserId: userId, createdAt: { gte: new Date(now.getTime() - DAY) } } })) >= MAX_NEW_PER_DAY) {
    throw new MarketError(429, {}, `You can post up to ${MAX_NEW_PER_DAY} listings in 24 hours. Please try again later.`);
  }
  const earlier = await prisma.marketListing.count({ where: { ownerUserId: userId } });
  const business = await prisma.business.findFirst({ where: { ownerUserId: userId, status: "APPROVED" }, select: { id: true } });

  const folder = `market/${randomUUID()}`;
  const stored: string[] = [];
  try {
    const rows: { key: string; thumbKey: string; width: number; height: number; sortOrder: number }[] = [];
    for (const [i, p] of processed.entries()) {
      const id = randomUUID();
      const key = `${folder}/${id}.webp`;
      const thumbKey = `${folder}/${id}-thumb.webp`;
      await storage!.put({ key, body: p.master, contentType: "image/webp" });
      stored.push(key);
      await storage!.put({ key: thumbKey, body: p.thumb, contentType: "image/webp" });
      stored.push(thumbKey);
      rows.push({ key, thumbKey, width: p.width, height: p.height, sortOrder: i });
    }
    const created = await prisma.marketListing.create({
      data: {
        slug: await uniqueSlug(prisma, title),
        ownerUserId: userId,
        kind: s.kind,
        isB2B: s.isB2B,
        title,
        description,
        pricePence,
        negotiable: s.negotiable,
        condition: s.condition ?? null,
        categoryId: category.id,
        postcode: coverage.postcode,
        postcodeDistrict: coverage.outward,
        hideFullAddress: s.hideFullAddress ?? !s.isB2B, // Q-M12-6: hidden by default for private sellers
        spotId,
        whatsapp: s.whatsapp,
        phone: s.phone ?? null,
        offerPassDiscount: s.offerPassDiscount,
        passDiscountNote: s.offerPassDiscount && s.passDiscountNote ? sanitizeText(s.passDiscountNote) : null,
        vatInvoice: s.vatInvoice,
        bulkTerms: s.bulkTerms ? sanitizeText(s.bulkTerms) : null,
        directoryBusinessId: business?.id ?? null,
        status: earlier < REVIEWED_FIRST_LISTINGS ? "PENDING" : "ACTIVE", // Q-M12-1
        expiresAt: new Date(now.getTime() + LISTING_DAYS * DAY),
        images: { create: rows },
      },
      select: mineSelect,
    });
    return toMine(created);
  } catch (err) {
    await Promise.allSettled(stored.map((k) => storage!.delete(k)));
    throw err;
  }
}

// ====================
// Edit
// ====================

const clearable = (max: number) => z.union([text(max), z.null()]);
// Strict: kind, category, postcode and status cannot change here.
export const editSchema = z
  .object({
    title: text(120),
    description: text(2000),
    price: z.number().min(0).max(1_000_000).nullable(),
    negotiable: z.boolean(),
    condition: z.enum(CONDITIONS).nullable(),
    hideFullAddress: z.boolean(),
    spotId: z.string().max(64).nullable(),
    whatsapp: fieldRules.phone,
    phone: z.union([fieldRules.phone, z.literal(""), z.null()]),
    offerPassDiscount: z.boolean(),
    passDiscountNote: clearable(200),
    vatInvoice: z.boolean(),
    bulkTerms: clearable(500),
  })
  .partial()
  .strict();

export async function editListing(prisma: PrismaClient, current: { id: string; kind: string; isB2B: boolean }, body: z.infer<typeof editSchema>) {
  const errors: FieldErrors = {};
  const data: Prisma.MarketListingUncheckedUpdateInput = {};
  if (body.title !== undefined) {
    data.title = sanitizeText(body.title);
    if (data.title.length < 5) errors.title = "The title must be at least 5 characters.";
  }
  if (body.description !== undefined) {
    data.description = sanitizeText(body.description);
    if (data.description.length < 20) errors.description = "The description must be at least 20 characters.";
  }
  if (body.price !== undefined) {
    if (current.kind === "GIVEAWAY" && body.price) errors.price = "A giveaway has no price.";
    else if (current.kind === "SELL" && body.price === null) errors.price = "Enter a price.";
    else data.pricePence = current.kind === "GIVEAWAY" || body.price === null ? null : Math.round(body.price * 100);
  }
  if (body.negotiable !== undefined) data.negotiable = body.negotiable;
  if (body.condition !== undefined) data.condition = body.condition;
  if (body.hideFullAddress !== undefined) data.hideFullAddress = body.hideFullAddress;
  if (body.spotId !== undefined) data.spotId = body.spotId === null ? null : await checkSpot(prisma, body.spotId, errors);
  if (body.whatsapp !== undefined) data.whatsapp = body.whatsapp;
  if (body.phone !== undefined) data.phone = body.phone || null;
  if (body.offerPassDiscount !== undefined) {
    data.offerPassDiscount = body.offerPassDiscount;
    if (!body.offerPassDiscount) data.passDiscountNote = null;
  }
  if (body.passDiscountNote !== undefined && body.offerPassDiscount !== false) data.passDiscountNote = body.passDiscountNote ? sanitizeText(body.passDiscountNote) : null;
  if (body.vatInvoice !== undefined) data.vatInvoice = body.vatInvoice;
  if (body.bulkTerms !== undefined) data.bulkTerms = body.bulkTerms ? sanitizeText(body.bulkTerms) : null;
  if (!current.isB2B && (body.vatInvoice || body.bulkTerms)) errors.isB2B = "VAT invoice and bulk terms are only for business listings.";
  if (Object.keys(errors).length) throw new MarketError(400, errors);
  return toMine(await prisma.marketListing.update({ where: { id: current.id }, data, select: mineSelect }));
}
