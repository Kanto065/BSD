import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { sanitizeText } from "../../common/sanitize.js";
import { publicWhere } from "../../common/public.js";
import { slugParams } from "./businesses.schema.js";
import { HONEYPOT_FIELD, fieldRules } from "./businesses.submit.js";
import { MAX_PROOF_BYTES, PROOF_TYPE_MESSAGE, sniffProof } from "../members/members.student.js";

// Requests about an existing listing, from its public page (FAQ Q8, Q9 and the "Claim This Listing" button):
//   claim             "this is my business"
//   request-update    "please change these details"
//   request-removal   "please take this listing down" (emergency when the information is wrong or sensitive)
// They go into admin queues. Only listings that are public can be asked about, and a hidden one returns 404.
//
// A claim (M9-D) is made by a signed-in member: written evidence and an optional document. The document goes to the
// private storage prefix (never public, admin only, deleted 24 hours after the decision). Name, email and phone come
// from the account. No email is sent and there is no code, an admin reads the evidence and decides.

const { phone } = fieldRules;
const requester = {
  name: z.string().trim().min(2, "Enter your name.").max(120),
  email: z.string().trim().max(200).email("Enter a valid email address."),
  phone: phone.optional().or(z.literal("")).transform((v) => v || undefined),
  [HONEYPOT_FIELD]: z.string().max(500).optional(),
};

const proofTextRule = z
  .string()
  .trim()
  .min(20, "Tell us briefly how you can show this is your business (at least 20 characters).")
  .max(1000, "Keep this to 1000 characters or fewer.");
const CLAIMS_PER_DAY = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const UNDECIDED_DAYS = 7;

const updateBody = z.object({
  ...requester,
  message: z.string().trim().min(10, "Tell us what should change.").max(2000),
});
const removalBody = z.object({
  ...requester,
  reason: z.string().trim().max(2000).optional(),
  isEmergency: z.boolean().default(false),
});

export const REQUEST_REPLIES = {
  claim: "Thank you. The BSD team will check your claim. The result will show on your account page.",
  update: "Thank you. Updates are usually processed within 3–7 working days.",
  removal: "Thank you. We will remove the listing within 3–7 working days.",
  emergency: "Thank you. Emergency removals are handled within 24 hours.",
};

type Parsed = { name: string; email: string; phone?: string; [HONEYPOT_FIELD]?: string };

const requestsRoutes: FastifyPluginAsync = async (app) => {
  const limited = { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } };

  async function handle<T extends Parsed>(
    req: { params: unknown; body: unknown; log: { info: (m: string) => void } },
    reply: { code: (n: number) => { send: (b: unknown) => unknown } },
    schema: z.ZodType<T>,
    /** What a real request of this kind is told, so a dropped spam request looks the same. */
    usualReply: string,
    save: (businessId: string, data: T, who: { requesterName: string; requesterEmail: string; requesterPhone: string | null }) => Promise<string>
  ) {
    const p = slugParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const body = schema.safeParse(req.body);
    if (!body.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of body.error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
      return reply.code(400).send({ ok: false, error: "Please check the highlighted fields.", fieldErrors });
    }
    const business = await app.prisma.business.findFirst({ where: publicWhere({ slug: p.data.slug }), select: { id: true } });
    if (!business) return reply.code(404).send({ error: "Not found" });
    const who = {
      requesterName: sanitizeText(body.data.name),
      requesterEmail: body.data.email,
      requesterPhone: body.data.phone ?? null,
    };
    if ((body.data[HONEYPOT_FIELD] ?? "").trim()) {
      req.log.info("listing request dropped by the honeypot field");
      return reply.code(201).send({ ok: true, message: usualReply });
    }
    const message = await save(business.id, body.data, who);
    return reply.code(201).send({ ok: true, message });
  }

  // Signed in members only. Multipart (text and an optional file), or plain JSON with proofText.
  app.post("/:slug/claim", { ...limited, preHandler: app.requireUser("Please sign in to claim a listing.") }, async (req, reply) => {
    const p = slugParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const userId = req.user!.id;

    let text = "";
    let file: Buffer | null = null;
    if (req.isMultipart()) {
      try {
        for await (const part of req.parts({ limits: { fileSize: MAX_PROOF_BYTES, files: 1, fields: 4, fieldSize: 4_000, parts: 5 } })) {
          if (part.type === "file") {
            const buf = await part.toBuffer(); // throws past the size limit
            if (part.fieldname === "proof" && !file && buf.length > 0) file = buf;
          } else if (part.fieldname === "proofText" && typeof part.value === "string") text = part.value;
        }
      } catch (err) {
        if ((err as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") return reply.code(413).send({ error: "That file is larger than 5 MB. Choose a smaller file." });
        return reply.code(400).send({ error: "We could not read that upload. Please try again." });
      }
    } else {
      text = String((req.body as { proofText?: unknown } | null)?.proofText ?? "");
    }
    const parsed = proofTextRule.safeParse(sanitizeText(text));
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: "Please check the highlighted fields.", fieldErrors: { proofText: parsed.error.issues[0]!.message } });
    }
    const kind = file ? sniffProof(file) : null;
    if (file && !kind) return reply.code(400).send({ error: PROOF_TYPE_MESSAGE });

    const business = await app.prisma.business.findFirst({ where: publicWhere({ slug: p.data.slug }), select: { id: true, ownerUserId: true } });
    if (!business) return reply.code(404).send({ error: "Not found" });
    if (business.ownerUserId === userId) return reply.code(409).send({ error: "This listing is already in your account." });
    if (await app.prisma.listingClaimRequest.findFirst({ where: { userId, businessId: business.id, status: "PENDING" }, select: { id: true } })) {
      return reply.code(409).send({ error: "You already have a claim for this listing waiting for review." });
    }
    const now = new Date();
    if ((await app.prisma.listingClaimRequest.count({ where: { userId, createdAt: { gte: new Date(now.getTime() - DAY_MS) } } })) >= CLAIMS_PER_DAY) {
      return reply.code(429).send({ error: "You have sent too many claims today. Please try again tomorrow." });
    }
    if (file && !app.storage) return reply.code(503).send({ error: "Uploads are temporarily unavailable. Please try again later." });

    const me = await app.prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, phone: true } });
    if (!me) return reply.code(401).send({ error: "Please sign in to claim a listing." });
    let key: string | null = null;
    if (file && kind) {
      key = `claims/${userId}/${randomUUID()}.${kind.ext}`;
      try {
        await app.storage!.put({ key, body: file, contentType: kind.type, private: true });
      } catch {
        return reply.code(503).send({ error: "Uploads are temporarily unavailable. Please try again later." });
      }
    }
    try {
      await app.prisma.listingClaimRequest.create({
        data: {
          businessId: business.id,
          userId,
          claimantName: me.name,
          claimantEmail: me.email,
          claimantPhone: me.phone,
          proofText: parsed.data,
          ...(key && kind && file ? { proofKey: key, proofType: kind.type, proofBytes: file.length, purgeAt: new Date(now.getTime() + UNDECIDED_DAYS * DAY_MS) } : {}),
        },
      });
    } catch (err) {
      if (key) await app.storage!.delete(key, { private: true }).catch(() => undefined);
      // The partial unique index catches two claims racing past the check above.
      if ((err as { code?: string }).code === "P2002") return reply.code(409).send({ error: "You already have a claim for this listing waiting for review." });
      throw err;
    }
    return reply.code(201).send({ ok: true, message: REQUEST_REPLIES.claim });
  });

  app.post("/:slug/request-update", limited, (req, reply) =>
    handle(req, reply, updateBody, REQUEST_REPLIES.update, async (businessId, d, who) => {
      await app.prisma.listingUpdateRequest.create({ data: { businessId, ...who, requestedChanges: { message: sanitizeText(d.message) } } });
      return REQUEST_REPLIES.update;
    })
  );

  app.post("/:slug/request-removal", limited, (req, reply) =>
    handle(req, reply, removalBody, REQUEST_REPLIES.removal, async (businessId, d, who) => {
      await app.prisma.listingRemovalRequest.create({
        data: { businessId, ...who, reason: d.reason ? sanitizeText(d.reason) : null, isEmergency: d.isEmergency },
      });
      return d.isEmergency ? REQUEST_REPLIES.emergency : REQUEST_REPLIES.removal;
    })
  );
};

export default requestsRoutes;
