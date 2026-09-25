import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { sanitizeText } from "../../common/sanitize.js";
import { publicWhere } from "../../common/public.js";
import { slugParams } from "./businesses.schema.js";
import { HONEYPOT_FIELD, fieldRules } from "./businesses.submit.js";

// Requests about an existing listing, from its public page (FAQ Q8, Q9 and the "Claim This Listing" button):
//   claim             "this is my business"
//   request-update    "please change these details"
//   request-removal   "please take this listing down" (emergency when the information is wrong or sensitive)
// They go into admin queues. Only listings that are public can be asked about, and a hidden one returns 404.
//
// A claim takes a written description of the proof, not an uploaded document: proof of ownership can include
// personal papers, and the upload bucket is public. Documents are exchanged by email with the support team.

const { phone } = fieldRules;
const requester = {
  name: z.string().trim().min(2, "Enter your name.").max(120),
  email: z.string().trim().max(200).email("Enter a valid email address."),
  phone: phone.optional().or(z.literal("")).transform((v) => v || undefined),
  [HONEYPOT_FIELD]: z.string().max(500).optional(),
};

const claimBody = z.object({
  ...requester,
  proof: z.string().trim().min(20, "Tell us briefly how you can show this is your business (at least 20 characters).").max(2000),
});
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
  claim: "Thank you. We will check your claim and reply by email, usually within 3–7 working days.",
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

  app.post("/:slug/claim", limited, (req, reply) =>
    handle(req, reply, claimBody, REQUEST_REPLIES.claim, async (businessId, d, who) => {
      await app.prisma.listingClaimRequest.create({
        data: { businessId, claimantName: who.requesterName, claimantEmail: who.requesterEmail, claimantPhone: who.requesterPhone, proofText: sanitizeText(d.proof) },
      });
      return REQUEST_REPLIES.claim;
    })
  );

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
