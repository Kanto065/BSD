import type { FastifyPluginAsync } from "fastify";

// M9-D, member side, mounted at /auth. GET /auth/claims lists the signed in member's own claims. The storage key of
// a document is never returned, only whether the claim has one.

const claimsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/claims", { preHandler: app.requireUser() }, async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    const rows = await app.prisma.listingClaimRequest.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        status: true,
        createdAt: true,
        reviewedAt: true,
        decisionNote: true,
        linkedOwner: true,
        proofKey: true,
        business: { select: { name: true, slug: true } },
      },
    });
    return { items: rows.map(({ proofKey, ...r }) => ({ ...r, hasProof: proofKey !== null })) };
  });
};

export default claimsRoutes;
