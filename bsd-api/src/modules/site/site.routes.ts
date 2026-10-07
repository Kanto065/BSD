import type { FastifyPluginAsync } from "fastify";
import { readConfig } from "./site.service.js";

// Public, no auth. Safe to cache: it holds only what the site itself displays.
const siteRoutes: FastifyPluginAsync = async (app) => {
  app.get("/config", async (_req, reply) => {
    reply.header("Cache-Control", "public, max-age=60");
    return readConfig(app.prisma);
  });
};

export default siteRoutes;
