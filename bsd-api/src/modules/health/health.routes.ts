import type { FastifyPluginAsync } from "fastify";

const healthRoutes: FastifyPluginAsync = async (app) => {
  // The process is up. Cheap, for container checks.
  app.get("/health", async () => ({ status: "ok" }));

  // Ready to serve: the database answers and image storage can be reached. For an external uptime monitor.
  // It says which part failed but never why, so it reveals nothing about the setup.
  app.get("/health/ready", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (_req, reply) => {
    const results = await Promise.allSettled([
      app.prisma.$queryRaw`SELECT 1`,
      app.storage ? app.storage.check() : Promise.reject(new Error("not configured")),
    ]);
    const database = results[0].status === "fulfilled" ? "ok" : "failing";
    const storage = results[1].status === "fulfilled" ? "ok" : "failing";
    const ok = database === "ok" && storage === "ok";
    if (!ok) app.log.error({ database, storage }, "readiness check failed");
    return reply.code(ok ? 200 : 503).send({ status: ok ? "ok" : "degraded", database, storage });
  });
};

export default healthRoutes;
