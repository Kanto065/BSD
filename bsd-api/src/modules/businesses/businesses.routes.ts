import type { FastifyPluginAsync } from "fastify";
import { badQuery } from "../../common/public.js";
import { featuredQuery, searchQuery, slugParams } from "./businesses.schema.js";
import { featuredBusinesses, getPublicBusiness, searchBusinesses } from "./businesses.service.js";

// Public and read-only. Only APPROVED listings are ever returned (see src/common/public.ts).
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

  app.get("/:slug", async (req, reply) => {
    const p = slugParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const business = await getPublicBusiness(app.prisma, p.data.slug);
    if (!business) return reply.code(404).send({ error: "Not found" });
    return business;
  });
};

export default businessesRoutes;
