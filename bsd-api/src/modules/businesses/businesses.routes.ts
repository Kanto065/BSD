import type { FastifyPluginAsync } from "fastify";
import { badQuery, publicWhere } from "../../common/public.js";
import { featuredQuery, searchQuery, slugParams } from "./businesses.schema.js";
import { featuredBusinesses, getPublicBusiness, searchBusinesses } from "./businesses.service.js";
import { HONEYPOT_FIELD, SubmissionError, readSubmission, saveSubmission } from "./businesses.submit.js";
import requestsRoutes from "./businesses.requests.js";

// The exact confirmation text from the client's Submission Form doc.
export const CONFIRMATION_MESSAGE =
  "Thank you! Your listing has been submitted for review. BSD Team will verify and publish it within 3–7 days.";

const SUBMIT_PER_HOUR = Number(process.env.SUBMIT_RATE_LIMIT ?? 5);

// Public routes. Reads only ever return APPROVED listings (see src/common/public.ts). The one write is a new
// submission, which is stored as PENDING and is not public until an admin approves it.
const businessesRoutes: FastifyPluginAsync = async (app) => {
  // Fixed paths are registered before the /:slug route so "search" and "featured" are never read as slugs.
  app.get("/featured", async (req, reply) => {
    const q = featuredQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send(badQuery(q.error));
    return featuredBusinesses(app.prisma, q.data);
  });

  app.get("/search", async (req, reply) => {
    const q = searchQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send(badQuery(q.error));
    return searchBusinesses(app.prisma, q.data);
  });

  app.post("/submit", { config: { rateLimit: { max: SUBMIT_PER_HOUR, timeWindow: "1 hour" } } }, async (req, reply) => {
    try {
      const raw = await readSubmission(req);
      if ((raw.fields.get(HONEYPOT_FIELD)?.[0] ?? "").trim()) {
        req.log.info("submission dropped by the honeypot field");
        return reply.code(201).send({ ok: true, message: CONFIRMATION_MESSAGE });
      }
      await saveSubmission(app.prisma, app.storage, raw);
      // The new listing's slug is not returned: it is not public yet, and nothing links to it.
      return reply.code(201).send({ ok: true, message: CONFIRMATION_MESSAGE });
    } catch (err) {
      if (err instanceof SubmissionError) {
        return reply.code(err.status).send({ ok: false, error: err.message, fieldErrors: err.fieldErrors });
      }
      throw err;
    }
  });

  app.register(requestsRoutes);

  // Every public listing, for the website's sitemap.
  app.get("/sitemap", async () => {
    const rows = await app.prisma.business.findMany({
      where: publicWhere(),
      select: { slug: true, reviewedAt: true, submittedAt: true },
      orderBy: { slug: "asc" },
      take: 50_000,
    });
    return { items: rows.map((r) => ({ slug: r.slug, lastModified: (r.reviewedAt ?? r.submittedAt).toISOString() })) };
  });

  app.get("/:slug", async (req, reply) => {
    const p = slugParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const business = await getPublicBusiness(app.prisma, p.data.slug);
    if (!business) return reply.code(404).send({ error: "Not found" });
    return business;
  });
};

export default businessesRoutes;
