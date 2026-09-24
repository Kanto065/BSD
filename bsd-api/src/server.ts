import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import prismaPlugin from "./plugins/prisma.js";
import authPlugin from "./plugins/auth.js";
import healthRoutes from "./modules/health/health.routes.js";
import categoriesRoutes from "./modules/categories/categories.routes.js";
import businessesRoutes from "./modules/businesses/businesses.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import contactRoutes from "./modules/contact/contact.routes.js";
import zonesRoutes from "./modules/zones/zones.routes.js";
import { loggerOptions } from "./common/logging.js";

export function buildApp() {
  const app = Fastify({ logger: loggerOptions() });

  app.register(cors, { origin: process.env.CORS_ORIGIN?.split(",") ?? true });
  app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
  app.register(prismaPlugin);
  app.register(authPlugin);

  app.register(healthRoutes);
  app.register(categoriesRoutes, { prefix: "/categories" });
  app.register(businessesRoutes, { prefix: "/businesses" });
  app.register(zonesRoutes, { prefix: "/zones" });
  app.register(adminRoutes, { prefix: "/admin" });
  app.register(contactRoutes, { prefix: "/contact" });

  return app;
}

async function start() {
  const app = buildApp();
  const port = Number(process.env.PORT ?? 4000);
  try {
    await app.listen({ port, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Start listening only when this file is the entry point (node dist/server.js, tsx src/server.ts), so tests
// can import buildApp without opening a port.
if (process.argv[1] && /server\.(ts|js)$/.test(process.argv[1])) {
  start();
}
