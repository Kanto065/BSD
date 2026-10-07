// The site sections the admin can show, hide, reorder or re-word (R-05, R-07). The keys match
// bsd-api/src/modules/site/site.registry.ts (sections.test.ts checks that). Everything here is pure, so it is
// safe to import from server and client components alike.

export type SectionState = { visible: boolean; title: string | null; body: string | null };
export type Maintenance = { enabled: boolean; textEn: string; textBn: string };
export type SiteConfig = {
  maintenance: Maintenance;
  sections: Record<string, SectionState>;
  homeOrder: string[];
  overridden: string[];
};

export const HOME_KEYS = ["home-categories", "home-zones", "home-featured", "home-owner", "home-how", "home-faq"];

/** Today's copy. What the site shows whenever the admin has not changed a field. */
export const SECTION_TEXT: Record<string, { title?: string; body?: string }> = {
  "home-categories": { title: "Popular Categories", body: "Find Verified Services Across South West Wales" },
  "home-zones": { title: "Explore by Regional Zones", body: "Click a zone to find local businesses near you" },
  "home-featured": { title: "Featured & Verified Local Businesses", body: "Hand-verified for operational quality & accuracy" },
  "home-owner": { title: "Are You a Local Business Owner?", body: "Put your services in front of thousands of local residents and community members." },
  "home-how": { title: "How It Works", body: "3 simple steps" },
  "home-faq": { title: "Frequently Asked Questions" },
  "footer-cta": { title: "Grow Your Business Across South West Wales", body: "Get listed in our community-verified directory or download our regional coverage guide." },
};

/** Page paths that can be hidden, by section key. Policy pages, submit and account are never hideable. */
export const PAGE_PATHS: Record<string, string> = {
  about: "/about",
  faq: "/faq",
  contact: "/contact",
  "coverage-area": "/coverage-area",
  "community-initiative": "/community-initiative",
  bayconnect: "/bayconnect",
  branding: "/branding",
  "download-pdf": "/download-pdf",
};

export const DEFAULT_CONFIG: SiteConfig = {
  maintenance: { enabled: false, textEn: "", textBn: "" },
  sections: {},
  homeOrder: HOME_KEYS,
  overridden: [],
};

/** Accepts whatever the API returned and fills any gap with today's site. Never throws. */
export function normalizeConfig(raw: unknown): SiteConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_CONFIG;
  const r = raw as Partial<SiteConfig>;
  const m = r.maintenance;
  const maintenance: Maintenance =
    m && typeof m.enabled === "boolean" && typeof m.textEn === "string" && typeof m.textBn === "string" ? m : DEFAULT_CONFIG.maintenance;
  const order = Array.isArray(r.homeOrder) ? r.homeOrder.filter((k) => HOME_KEYS.includes(k)) : [];
  const homeOrder = [...new Set([...order, ...HOME_KEYS])];
  return { maintenance, sections: r.sections && typeof r.sections === "object" ? r.sections : {}, homeOrder, overridden: Array.isArray(r.overridden) ? r.overridden : [] };
}

export function sectionText(config: SiteConfig, key: string, field: "title" | "body"): string {
  return config.sections[key]?.[field] || SECTION_TEXT[key]?.[field] || "";
}

export const isVisible = (config: SiteConfig, key: string) => config.sections[key]?.visible !== false;

/** Paths of hideable pages that are currently hidden. */
export function hiddenPaths(config: SiteConfig): string[] {
  return Object.entries(PAGE_PATHS).filter(([key]) => !isVisible(config, key)).map(([, path]) => path);
}

const ENTITIES: Record<string, string> = { "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&#x27;": "'", "&nbsp;": " " };

/**
 * What the API will store for a text field: tags removed (script, style and similar elements with their contents),
 * common entities decoded, control characters dropped, whitespace tidied. Mirrors sanitizeText in
 * bsd-api/src/common/sanitize.ts, which stays the authority. Used only to preview the banner before saving.
 */
export function plainText(value: string): string {
  return value
    .replace(/<(script|style|textarea|option)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<!--[\s\S]*?-->|<[!?][^>]*>|<\/?[a-zA-Z][^>]*>/g, "")
    .replace(/&(lt|gt|quot|#39|#x27|nbsp);/g, (m) => ENTITIES[m]!)
    .replace(/&amp;/g, "&")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The non-empty banner lines, English first. Plain text only: the banner renders them as text nodes. */
export function bannerLines(m: Maintenance): string[] {
  if (!m.enabled) return [];
  return [m.textEn, m.textBn].map((t) => t.trim()).filter(Boolean);
}
