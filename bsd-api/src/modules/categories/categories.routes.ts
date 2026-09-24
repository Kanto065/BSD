import type { FastifyPluginAsync } from "fastify";
import { badQuery } from "../../common/public.js";
import { categoryDetailQuery, categoryParams } from "./categories.schema.js";
import { getCategory, listCategories } from "./categories.service.js";

const categoriesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => ({ categories: await listCategories(app.prisma) }));

  app.get("/:slug", async (req, reply) => {
    const p = categoryParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const q = categoryDetailQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send(badQuery(q.error));
    const result = await getCategory(app.prisma, p.data.slug, q.data);
    if (!result) return reply.code(404).send({ error: "Not found" });
    return result;
  });
};

export default categoriesRoutes;
