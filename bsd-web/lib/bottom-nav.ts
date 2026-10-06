import { SITES, type SiteKey } from "@/lib/site";

export type NavKey = "home" | "search" | "pass" | "market" | "profile";

export const NAV_KEYS: NavKey[] = ["home", "search", "pass", "market", "profile"];

const PATHS: Record<"home" | "search" | "profile", string> = { home: "/", search: "/search", profile: "/account" };

export function navHref(site: SiteKey, key: NavKey): string {
  if (key === "pass") return SITES.card.origin;
  if (key === "market") return SITES.market.origin;
  return (site === "bsd" ? "" : SITES.bsd.origin) + PATHS[key];
}

function under(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(base + "/");
}

export function activeKey(site: SiteKey, pathname: string): NavKey | null {
  if (site === "card") return "pass";
  if (site === "market") return "market";
  if (pathname === "/") return "home";
  if (under(pathname, "/search")) return "search";
  if (under(pathname, "/account")) return "profile";
  return null;
}

export function showBottomNav(pathname: string): boolean {
  return !under(pathname, "/admin");
}
