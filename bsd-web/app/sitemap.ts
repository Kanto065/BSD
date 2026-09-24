import type { MetadataRoute } from "next";
import { CATEGORIES, SITE_URL, ZONES } from "@/lib/content";

// Placeholder shells (/community-guidelines, /complaints, /financial-transparency) and /search are noindex,
// so they are left out on purpose.
export default function sitemap(): MetadataRoute.Sitemap {
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
  ].map((path) => ({
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

  const categoryRoutes = CATEGORIES.map((c) => ({
    url: `${SITE_URL}/categories/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...zoneRoutes, ...categoryRoutes];
}
