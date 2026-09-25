import type { Prisma, PrismaClient } from "@prisma/client";
import type { FastifyReply } from "fastify";
import { z } from "zod";

type Db = PrismaClient | Prisma.TransactionClient;

/** Every admin action is written to the audit log, in the same transaction as the change it records. */
export function audit(
  db: Db,
  adminId: string,
  action: string,
  entityType: string,
  entityId: string,
  details?: Prisma.InputJsonValue
) {
  return db.auditLog.create({ data: { adminId, action, entityType, entityId, details } });
}

/** Field-by-field before and after, for the audit log. Only fields that actually changed. */
export function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    const a = before[key];
    const b = after[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) changes[key] = { from: a ?? null, to: b ?? null };
  }
  return changes;
}

export const idParams = z.object({ id: z.string().min(1).max(64) });

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export function invalid(reply: FastifyReply, error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return reply.code(400).send({ error: "Please check the highlighted fields.", fieldErrors });
}

/** Number of listings in each moderation status. */
export async function statusCounts(prisma: PrismaClient) {
  const rows = await prisma.business.groupBy({ by: ["status"], _count: { _all: true } });
  const count = (s: string) => rows.find((r) => r.status === s)?._count._all ?? 0;
  return { PENDING: count("PENDING"), APPROVED: count("APPROVED"), REJECTED: count("REJECTED"), REMOVED: count("REMOVED") };
}

export const page = (p: { page: number; pageSize: number }) => ({ skip: (p.page - 1) * p.pageSize, take: p.pageSize });
