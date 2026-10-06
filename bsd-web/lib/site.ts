// Local dev: card.localhost:3000 and marketplace.localhost:3000 work in Chrome without a hosts file.
import { SITE_URL } from "@/lib/content";

export type SiteKey = "bsd" | "card" | "market";

export const SITES = {
  bsd: {
    name: "Bangladeshi Business & Service Directory",
    shortName: "BSD",
    origin: SITE_URL,
    description: "Find Bangladeshi businesses and services across Swansea Bay.",
    themeColor: "#0C2E42",
    prefix: "",
    letter: "B",
  },
  card: {
    name: "BSD Privilege Pass",
    shortName: "Pass",
    origin: "https://card.bsd.wales",
    description: "A membership pass with offers from local Bangladeshi businesses.",
    themeColor: "#0D9488",
    prefix: "/card-site",
    letter: "P",
  },
  market: {
    name: "BSD Marketplace",
    shortName: "Market",
    origin: "https://marketplace.bsd.wales",
    description: "A place to buy and sell within the Bangladeshi community.",
    themeColor: "#005A8C",
    prefix: "/market-site",
    letter: "M",
  },
} as const;

export type SiteInfo = (typeof SITES)[SiteKey];

const HOSTS: Record<string, SiteKey> = {
  "card.bsd.wales": "card",
  "card.localhost": "card",
  "marketplace.bsd.wales": "market",
  "marketplace.localhost": "market",
};

export function siteFromHost(host?: string | null): SiteKey {
  const h = (host ?? "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
  return HOSTS[h] ?? "bsd";
}

export type RouteResult = { action: "next" } | { action: "rewrite"; to: string } | { action: "notFound" };

const INTERNAL = ["/card-site", "/market-site"];
const isInternal = (p: string) => INTERNAL.some((i) => p === i || p.startsWith(i + "/"));
const SHARED = ["/manifest.webmanifest", "/robots.txt", "/favicon.ico"];

export function resolveRoute(site: SiteKey, pathname: string): RouteResult {
  if (isInternal(pathname)) return { action: "notFound" };
  if (site === "bsd") return { action: "next" };
  if (SHARED.includes(pathname) || pathname.startsWith("/pwa-icon/")) return { action: "next" };
  return { action: "rewrite", to: pathname === "/" ? SITES[site].prefix : SITES[site].prefix + pathname };
}

export function buildManifest(site: SiteKey) {
  const s = SITES[site];
  const icon = (size: number, purpose: "any" | "maskable") => ({
    src: `/pwa-icon/${size}`,
    sizes: `${size}x${size}`,
    type: "image/png",
    purpose,
  });
  return {
    name: s.name,
    short_name: s.shortName,
    description: s.description,
    start_url: "/",
    scope: "/",
    display: "standalone" as const,
    background_color: site === "bsd" ? "#FFFFFF" : "#F8FAFC",
    theme_color: s.themeColor,
    icons: [icon(192, "any"), icon(512, "any"), icon(192, "maskable"), icon(512, "maskable")],
  };
}
