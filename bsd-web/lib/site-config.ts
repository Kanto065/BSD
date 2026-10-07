import { notFound } from "next/navigation";
import { apiGet } from "@/lib/api";
import { DEFAULT_CONFIG, isVisible, normalizeConfig, type SiteConfig } from "@/lib/sections";

// Server side. The admin settings come from the public API and are cached for 60 seconds. If the API cannot be
// reached the site shows its default state (banner off, every section visible, today's copy).
/** Pass fresh for a copy that skips the 60 second cache (the sitemap, so a hidden page leaves it at once). */
export async function getSiteConfig(fresh = false): Promise<SiteConfig> {
  const res = await apiGet<unknown>("/site/config", fresh ? {} : { revalidate: 60 });
  return res.ok ? normalizeConfig(res.data) : DEFAULT_CONFIG;
}

/** Call at the top of a hideable page. A hidden section answers 404, like a page that does not exist. */
export async function requireVisible(key: string): Promise<void> {
  if (!isVisible(await getSiteConfig(), key)) notFound();
}
