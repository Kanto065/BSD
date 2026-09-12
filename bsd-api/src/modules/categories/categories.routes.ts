import type { FastifyPluginAsync } from "fastify";

// Implemented starting in M1/M2/M3 per the milestone roadmap — this module is
// registered now so the app boots with the full domain structure in place.
const categoriesRoutes: FastifyPluginAsync = async () => {};

export default categoriesRoutes;
