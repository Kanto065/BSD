import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { AdminRole } from "@prisma/client";
import { verifyToken } from "../common/tokens.js";

// Admin authentication and role checks. The real security boundary: the admin web pages only hide links.
//
// Every admin request carries a short-lived access token. It is checked, then the admin is loaded from the database on
// every request, so a disabled account, a role change or a password change takes effect immediately.

export type AuthedAdmin = { id: string; name: string; email: string; role: AdminRole; mustChangePassword: boolean };

declare module "fastify" {
  interface FastifyInstance {
    /** preHandler: requires a signed-in admin with one of these roles. No roles means any admin. */
    requireRole: (...roles: AdminRole[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    admin?: AuthedAdmin;
  }
  interface FastifyContextConfig {
    /** Routes a person with a temporary password may still use (to see who they are and change it). */
    allowWithTemporaryPassword?: boolean;
  }
}

// What each role may do. A higher role can do everything a lower one can.
const RANK: Record<AdminRole, number> = { VOLUNTEER: 1, MODERATOR: 2, ADMIN: 3, SUPER_ADMIN: 4 };
export const atLeast = (role: AdminRole, minimum: AdminRole) => RANK[role] >= RANK[minimum];

const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorate("requireRole", (...roles: AdminRole[]) => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      const header = req.headers.authorization;
      const claims = header?.startsWith("Bearer ") ? verifyToken(header.slice(7), "access") : null;
      if (!claims) return reply.code(401).send({ error: "Please sign in." });

      const admin = await app.prisma.adminUser.findUnique({
        where: { id: claims.sub },
        select: { id: true, name: true, email: true, role: true, active: true, tokenVersion: true, mustChangePassword: true },
      });
      if (!admin || !admin.active || admin.tokenVersion !== claims.tv) {
        return reply.code(401).send({ error: "Your session has ended. Please sign in again." });
      }
      if (admin.mustChangePassword && !req.routeOptions.config?.allowWithTemporaryPassword) {
        return reply.code(403).send({ error: "Please set a new password first.", code: "password_change_required" });
      }
      if (roles.length && !roles.some((r) => admin.role === r)) {
        return reply.code(403).send({ error: "You do not have permission to do that." });
      }
      req.admin = { id: admin.id, name: admin.name, email: admin.email, role: admin.role, mustChangePassword: admin.mustChangePassword };
    };
  });
};

/** Roles at or above the given one, for requireRole(...rolesFrom("MODERATOR")). */
export function rolesFrom(minimum: AdminRole): AdminRole[] {
  return (Object.keys(RANK) as AdminRole[]).filter((r) => atLeast(r, minimum));
}

export default fp(authPlugin);
