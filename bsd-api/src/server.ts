import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import cookie from "@fastify/cookie";
import prismaPlugin from "./plugins/prisma.js";
import authPlugin from "./plugins/auth.js";
import healthRoutes from "./modules/health/health.routes.js";
import categoriesRoutes from "./modules/categories/categories.routes.js";
import businessesRoutes from "./modules/businesses/businesses.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import contactRoutes from "./modules/contact/contact.routes.js";
import zonesRoutes from "./modules/zones/zones.routes.js";
import { loggerOptions } from "./common/logging.js";
import { storageFromEnv, type ObjectStorage } from "./common/storage.js";
import { UPLOAD_LIMITS } from "./modules/businesses/businesses.submit.js";

declare module "fastify" {
  interface FastifyInstance {
    /** Null when image storage is not configured (uploads are then refused). */
    storage: ObjectStorage | null;
  }
}

export type AppOptions = { storage?: ObjectStorage | null };

const PRIVATE_ADDRESS = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1$|::ffff:(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.))/;

export function buildApp(opts: AppOptions = {}) {
  const app = Fastify({
    logger: loggerOptions(),
    // Every public request arrives through the shared Caddy, which sets X-Forwarded-For to the real client address.
    // Trusting exactly one hop makes req.ip that client, so per-visitor rate limits work. Without it every visitor
    // looks like Caddy and shares one limit.
    trustProxy: (_address: string, hop: number) => hop < 1,
  });

  app.decorate("storage", opts.storage !== undefined ? opts.storage : storageFromEnv());

  // credentials: the admin pages on bsd.wales send the httpOnly refresh cookie to api.bsd.wales.
  app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(",") ?? true,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "DELETE"],
  });
  app.register(cookie);
  app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    // The website's own server calls the API directly over the Docker network (no Caddy, so no X-Forwarded-For).
    // Those calls serve every visitor at once, so they are not counted against a single visitor's limit.
    allowList: (req) => !req.headers["x-forwarded-for"] && PRIVATE_ADDRESS.test(req.socket.remoteAddress ?? ""),
  });
  app.register(multipart, { limits: UPLOAD_LIMITS, throwFileSizeLimit: true });
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
  if (!app.storage) app.log.warn("Image storage is not configured (S3_* variables). Uploads will be refused.");
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
