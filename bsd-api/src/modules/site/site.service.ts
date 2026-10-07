import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { HOME_KEYS, SECTIONS } from "./site.registry.js";

export const BANNER_MAX = 200;

const maintenanceSchema = z.object({ enabled: z.boolean(), textEn: z.string().max(BANNER_MAX), textBn: z.string().max(BANNER_MAX) });
const itemSchema = z.object({ visible: z.boolean().optional(), title: z.string().nullable().optional(), body: z.string().nullable().optional() });
const sectionsSchema = z.object({ items: z.record(itemSchema).default({}), order: z.array(z.string()).default([]) });

export const MAINTENANCE_DEFAULT = { enabled: false, textEn: "", textBn: "" };

export type SiteConfig = {
  maintenance: z.infer<typeof maintenanceSchema>;
  sections: Record<string, { visible: boolean; title: string | null; body: string | null }>;
  homeOrder: string[];
  /** Keys that differ from today's site, so a live copy difference can be explained. */
  overridden: string[];
};

/** Full order: the stored order first (known home keys only, no repeats), then any missing key in default order. */
export function fullOrder(stored: string[]): string[] {
  const seen = [...new Set(stored.filter((k) => HOME_KEYS.includes(k)))];
  return [...seen, ...HOME_KEYS.filter((k) => !seen.includes(k))];
}

/** Reads the settings table. Never throws on bad or missing data: anything unreadable falls back to today's site. */
export async function readConfig(db: Pick<PrismaClient, "siteSetting">): Promise<SiteConfig> {
  const rows = await db.siteSetting.findMany({ where: { key: { in: ["maintenance", "sections"] } } });
  const raw = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const m = maintenanceSchema.safeParse(raw.maintenance);
  const s = sectionsSchema.safeParse(raw.sections);
  const stored = s.success ? s.data : { items: {}, order: [] };
  const maintenance = m.success ? m.data : MAINTENANCE_DEFAULT;
  const sections: SiteConfig["sections"] = {};
  const overridden: string[] = [];
  for (const def of SECTIONS) {
    const it = stored.items[def.key] ?? {};
    const visible = def.locked ? true : (it.visible ?? true);
    const title = def.text && it.title ? it.title : null;
    const body = def.text?.body && it.body ? it.body : null;
    sections[def.key] = { visible, title, body };
    if (!visible || title || body) overridden.push(def.key);
  }
  const homeOrder = fullOrder(stored.order);
  if (homeOrder.join() !== HOME_KEYS.join()) overridden.push("order");
  if (maintenance.enabled) overridden.push("maintenance");
  return { maintenance, sections, homeOrder, overridden };
}

export async function saveSetting(db: Pick<PrismaClient, "siteSetting">, key: string, value: object, adminId: string) {
  await db.siteSetting.upsert({
    where: { key },
    create: { key, value, updatedById: adminId },
    update: { value, updatedById: adminId },
  });
}
