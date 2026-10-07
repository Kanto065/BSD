import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { parsePostcode } from "../../common/postcode.js";
import { sanitizeText, sanitizeTextArray } from "../../common/sanitize.js";
import { invalid } from "../admin/admin.service.js";
import { fieldRules } from "../businesses/businesses.submit.js";

// The saved business details of one member. The stepper on Submit and the details page save into it, and every later
// form (listing, and later Pass merchant and Marketplace seller) reads from it. It is a draft, so nothing is required.
// Photos, logo and the six consents are never stored here: files belong to a listing, and consent is given per submission.

const { text } = fieldRules;
export const PROFILE_LAST_STEP = 4; // five steps, counted from 0

const profileData = z
  .object({
    name: text(120),
    categorySlug: text(100),
    customCategory: text(60),
    subcategorySlug: text(100),
    description: text(2000),
    servicesOffered: z.array(text(100)).max(15),
    ownerName: text(120),
    phone: text(25),
    whatsapp: text(25),
    email: text(200),
    showEmail: z.boolean(),
    websiteOrSocial: text(300),
    address: text(300),
    postcode: text(12),
    serveZones: z.array(text(100)).max(3),
    localities: z.array(text(100)).max(60),
    otherAreaText: text(300),
    openingHours: text(500),
    specialNotes: text(500),
  })
  .partial()
  .strict();

const putBody = z.object({ data: profileData, step: z.number().int().min(0).max(PROFILE_LAST_STEP) }).strict();

/** Cleans a draft: HTML stripped from text, arrays cleaned, and the postcode normalised only when it parses. */
export function cleanProfile(data: z.infer<typeof profileData>): Record<string, string | boolean | string[]> {
  const out: Record<string, string | boolean | string[]> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) out[key] = sanitizeTextArray(value);
    else if (typeof value === "boolean") out[key] = value;
    else out[key] = sanitizeText(value);
  }
  if (typeof out.postcode === "string" && out.postcode) {
    const parsed = parsePostcode(out.postcode);
    if (parsed.ok) out.postcode = parsed.postcode;
  }
  return out;
}

const businessProfileRoutes: FastifyPluginAsync = async (app) => {
  const auth = { preHandler: app.requireUser() };

  app.get("/business-profile", auth, async (req) => {
    const row = await app.prisma.businessProfile.findUnique({ where: { userId: req.user!.id } });
    return row ? { data: row.data, step: row.step, updatedAt: row.updatedAt } : { data: {}, step: 0 };
  });

  app.put("/business-profile", { ...auth, config: { rateLimit: { max: 60, timeWindow: "1 hour" } } }, async (req, reply) => {
    const body = putBody.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    const data = cleanProfile(body.data.data) as Prisma.InputJsonObject;
    const row = await app.prisma.businessProfile.upsert({
      where: { userId: req.user!.id },
      create: { userId: req.user!.id, data, step: body.data.step },
      update: { data, step: body.data.step },
    });
    return { data: row.data, step: row.step, updatedAt: row.updatedAt };
  });

  app.delete("/business-profile", auth, async (req) => {
    await app.prisma.businessProfile.deleteMany({ where: { userId: req.user!.id } });
    return { data: {}, step: 0 };
  });
};

export default businessProfileRoutes;
