import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { rolesFrom } from "../../plugins/auth.js";
import { sanitizeText } from "../../common/sanitize.js";
import { HOME_KEYS, SECTIONS, byKey } from "../site/site.registry.js";
import { BANNER_MAX, fullOrder, readConfig, saveSetting } from "../site/site.service.js";
import { audit, invalid } from "./admin.service.js";

// Site settings (ADMIN and SUPER_ADMIN): the maintenance banner, which sections show, the homepage order and the
// editable headings. Changes reach the public site within about a minute (the public config is cached for 60 seconds).
// Text is stored as plain text and the website renders it as plain text.

const text = z.string().max(BANNER_MAX * 2).transform((v) => sanitizeText(v));

const maintenanceBody = z
  .object({ enabled: z.boolean(), textEn: text, textBn: text })
  .strict()
  .refine((v) => v.textEn.length <= BANNER_MAX && v.textBn.length <= BANNER_MAX, { message: `Keep each banner text under ${BANNER_MAX} characters.`, path: ["textEn"] })
  .refine((v) => !v.enabled || v.textEn.length > 0 || v.textBn.length > 0, { message: "Add the banner text before turning it on.", path: ["textEn"] });

const sectionsBody = z
  .object({
    items: z.record(z.object({ visible: z.boolean(), title: z.string().max(300).nullable(), body: z.string().max(600).nullable() }).strict()),
    order: z.array(z.string().max(64)).max(50),
  })
  .strict();

const siteAdminRoutes: FastifyPluginAsync = async (app) => {
  const admins = { preHandler: app.requireRole(...rolesFrom("ADMIN")) };

  app.get("/site", admins, async () => ({ ...(await readConfig(app.prisma)), bannerMax: BANNER_MAX, registry: SECTIONS }));

  app.put("/site/maintenance", admins, async (req, reply) => {
    const body = maintenanceBody.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    await app.prisma.$transaction(async (tx) => {
      await saveSetting(tx, "maintenance", body.data, req.admin!.id);
      await audit(tx, req.admin!.id, "UPDATE_SITE_MAINTENANCE", "SiteSetting", "maintenance", { enabled: body.data.enabled });
    });
    return readConfig(app.prisma);
  });

  app.put("/site/sections", admins, async (req, reply) => {
    const body = sectionsBody.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    const bad = (error: string) => reply.code(400).send({ error });
    const items: Record<string, { visible: boolean; title: string | null; body: string | null }> = {};
    for (const [key, v] of Object.entries(body.data.items)) {
      const def = byKey(key);
      if (!def) return bad(`Unknown section "${key}".`);
      if (def.locked && !v.visible) return bad(`${def.label} cannot be hidden. ${def.locked}`);
      const title = v.title ? sanitizeText(v.title) : "";
      const sbody = v.body ? sanitizeText(v.body) : "";
      if (title && (!def.text || title.length > def.text.title)) return bad(`The heading for ${def.label} can be at most ${def.text?.title ?? 0} characters.`);
      if (sbody && (!def.text?.body || sbody.length > def.text.body)) return bad(`The text for ${def.label} can be at most ${def.text?.body ?? 0} characters.`);
      items[key] = { visible: v.visible, title: title || null, body: sbody || null };
    }
    if (body.data.order.some((k) => !HOME_KEYS.includes(k))) return bad("Only homepage sections can be reordered.");
    const order = fullOrder(body.data.order);
    await app.prisma.$transaction(async (tx) => {
      await saveSetting(tx, "sections", { items, order }, req.admin!.id);
      await audit(tx, req.admin!.id, "UPDATE_SITE_SECTIONS", "SiteSetting", "sections", {
        hidden: Object.entries(items).filter(([, v]) => !v.visible).map(([k]) => k),
        edited: Object.entries(items).filter(([, v]) => v.title || v.body).map(([k]) => k),
        order,
      });
    });
    return readConfig(app.prisma);
  });
};

export default siteAdminRoutes;
