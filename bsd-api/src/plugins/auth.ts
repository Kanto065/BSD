import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";

declare module "fastify" {
  interface FastifyInstance {
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    adminUser?: { id: string; role: string };
  }
}

const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorate("requireAdmin", async (req, reply) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Missing bearer token" });
    }
    const token = header.slice("Bearer ".length);
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) throw new Error("JWT_SECRET not configured");
      const payload = jwt.verify(token, secret) as { sub: string; role: string };
      req.adminUser = { id: payload.sub, role: payload.role };
    } catch {
      return reply.code(401).send({ error: "Invalid or expired token" });
    }
  });
};

export default fp(authPlugin);
