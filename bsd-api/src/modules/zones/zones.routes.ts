import type { FastifyPluginAsync } from "fastify";
import { badQuery } from "../../common/public.js";
import { zoneDetailQuery, zoneParams } from "./zones.schema.js";
import { getZone, listZones } from "./zones.service.js";

const zonesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => ({ zones: await listZones(app.prisma) }));

  app.get("/:slug", async (req, reply) => {
    const p = zoneParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const q = zoneDetailQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send(badQuery(q.error));
    const result = await getZone(app.prisma, p.data.slug, q.data);
    if (!result) return reply.code(404).send({ error: "Not found" });
    return result;
  });
};

export default zonesRoutes;
