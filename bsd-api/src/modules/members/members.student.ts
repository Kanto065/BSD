import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { sniffImageType } from "../../common/images.js";
import { sanitizeText } from "../../common/sanitize.js";

// R-11. A signed-in member sends proof of student status, an admin checks it (admin.students.ts). The file goes to the
// private storage prefix and is never given a public URL. This route never returns the storage key.

export const MAX_PROOF_BYTES = 5 * 1024 * 1024;
export const PROOF_TYPE_MESSAGE = "Upload a JPG, PNG, WebP or PDF file.";
const PER_DAY = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const UNDECIDED_DAYS = 7;

const TYPES = {
  jpeg: { type: "image/jpeg", ext: "jpg" },
  png: { type: "image/png", ext: "png" },
  webp: { type: "image/webp", ext: "webp" },
  pdf: { type: "application/pdf", ext: "pdf" },
} as const;

/** What the bytes really are. The mimetype and file name a browser sends are not trusted. */
export function sniffProof(buf: Buffer): (typeof TYPES)[keyof typeof TYPES] | null {
  const image = sniffImageType(buf);
  if (image) return TYPES[image];
  if (buf.length >= 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-") return TYPES.pdf;
  return null;
}

const studentRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onSend", async (_req, reply) => {
    reply.header("Cache-Control", "no-store");
  });
  const user = { preHandler: app.requireUser() };

  async function state(userId: string) {
    const [latest, badge] = await Promise.all([
      app.prisma.studentVerification.findFirst({
        where: { userId },
        orderBy: { submittedAt: "desc" },
        select: { status: true, submittedAt: true, decidedAt: true, rejectionReason: true },
      }),
      app.prisma.userBadge.findUnique({ where: { userId_badge: { userId, badge: "STUDENT" } }, select: { userId: true } }),
    ]);
    return { ...(latest ?? { status: "NONE" as const }), verified: !!badge };
  }

  app.get("/", user, async (req) => state(req.user!.id));

  app.post("/proof", { ...user, config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (req, reply) => {
    if (!app.storage) return reply.code(503).send({ error: "Uploads are temporarily unavailable. Please try again later." });
    if (!req.isMultipart()) return reply.code(415).send({ error: "Send the file as multipart/form-data." });
    const userId = req.user!.id;

    let file: Buffer | null = null;
    let note = "";
    try {
      for await (const part of req.parts({ limits: { fileSize: MAX_PROOF_BYTES, files: 1, fields: 5, fieldSize: 2_000, parts: 6 } })) {
        if (part.type === "file") {
          const buf = await part.toBuffer(); // throws past the size limit
          if (part.fieldname === "proof" && !file) file = buf;
        } else if (part.fieldname === "note" && typeof part.value === "string") note = part.value;
      }
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "FST_REQ_FILE_TOO_LARGE") return reply.code(413).send({ error: "That file is larger than 5 MB. Choose a smaller file." });
      return reply.code(400).send({ error: "We could not read that upload. Please try again." });
    }
    if (!file || file.length === 0) return reply.code(400).send({ error: "Choose a file to upload." });
    const kind = sniffProof(file);
    if (!kind) return reply.code(400).send({ error: PROOF_TYPE_MESSAGE });
    const cleanNote = sanitizeText(note);
    if (cleanNote.length > 300) return reply.code(400).send({ error: "Keep the note to 300 characters or fewer." });

    const now = new Date();
    if (await app.prisma.userBadge.findUnique({ where: { userId_badge: { userId, badge: "STUDENT" } }, select: { userId: true } })) {
      return reply.code(409).send({ error: "Your student status is already verified." });
    }
    if (await app.prisma.studentVerification.findFirst({ where: { userId, status: "PENDING" }, select: { id: true } })) {
      return reply.code(409).send({ error: "You already have a request waiting for review." });
    }
    if ((await app.prisma.studentVerification.count({ where: { userId, submittedAt: { gte: new Date(now.getTime() - DAY_MS) } } })) >= PER_DAY) {
      return reply.code(429).send({ error: "You have sent too many requests today. Please try again tomorrow." });
    }

    const key = `students/${userId}/${randomUUID()}.${kind.ext}`;
    try {
      await app.storage.put({ key, body: file, contentType: kind.type, private: true });
    } catch {
      return reply.code(503).send({ error: "Uploads are temporarily unavailable. Please try again later." });
    }
    try {
      await app.prisma.studentVerification.create({
        data: {
          userId,
          proofKey: key,
          proofType: kind.type,
          proofBytes: file.length,
          note: cleanNote || null,
          submittedAt: now,
          purgeAt: new Date(now.getTime() + UNDECIDED_DAYS * DAY_MS),
        },
      });
    } catch (err) {
      await app.storage.delete(key, { private: true }).catch(() => undefined);
      // The partial unique index catches two uploads racing past the check above.
      if ((err as { code?: string }).code === "P2002") return reply.code(409).send({ error: "You already have a request waiting for review." });
      throw err;
    }
    return reply.code(201).send(await state(userId));
  });

  // The member withdraws a request that is still waiting. The file is deleted now.
  app.delete("/proof", user, async (req, reply) => {
    const userId = req.user!.id;
    const row = await app.prisma.studentVerification.findFirst({ where: { userId, status: "PENDING" }, select: { id: true, proofKey: true } });
    if (!row) return reply.code(404).send({ error: "You have no request waiting for review." });
    if (row.proofKey && app.storage) await app.storage.delete(row.proofKey, { private: true });
    await app.prisma.studentVerification.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: { status: "EXPIRED", proofKey: null, purgedAt: new Date() },
    });
    return state(userId);
  });
};

export default studentRoutes;
