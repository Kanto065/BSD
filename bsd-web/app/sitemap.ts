import type { MetadataRoute } from "next";
import { SITE_URL, ZONES } from "@/lib/content";
import { getCategories } from "@/lib/taxonomy";
import { apiGet } from "@/lib/api";
import { getSiteConfig } from "@/lib/site-config";
import { hiddenPaths } from "@/lib/sections";

// Built per request so a page hidden in the admin panel leaves the sitemap within about a minute (the site settings
// fetch is cached for 60 seconds, and a prerendered copy would also serve one stale answer after that). Crawlers
// ask rarely, so the cost is small.
export const dynamic = "force-dynamic";

// Placeholder shells (/community-guidelines, /complaints, /financial-transparency) and /search are noindex,
// so they are left out on purpose.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const hidden = hiddenPaths(await getSiteConfig(true));
  const staticRoutes = [
    "",
    "/categories",
    "/about",
    "/coverage-area",
    "/community-initiative",
    "/free-access",
    "/bayconnect",
    "/verification-policy",
    "/download-pdf",
    "/legal",
    "/privacy",
    "/faq",
    "/contact",
    "/branding",
    "/submit",
  ].filter((path) => !hidden.includes(path)).map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));

  const zoneRoutes = ZONES.map((z) => ({
    url: `${SITE_URL}/${z.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const categoryRoutes = (await getCategories()).map((c) => ({
    url: `${SITE_URL}/categories/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  // Every public listing page (empty while the site is being built, filled in once it is running).
  const listings = await apiGet<{ items: { slug: string; lastModified: string }[] }>("/businesses/sitemap", { revalidate: 3600 });
  const businessRoutes = listings.ok
    ? listings.data.items.map((b) => ({
        url: `${SITE_URL}/businesses/${b.slug}`,
        lastModified: new Date(b.lastModified),
        changeFrequency: "monthly" as const,
        priority: 0.5,
      }))
    : [];

  return [...staticRoutes, ...zoneRoutes, ...categoryRoutes, ...businessRoutes];
}
