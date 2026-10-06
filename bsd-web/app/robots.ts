import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { SITE_URL } from "@/lib/content";
import { siteFromHost } from "@/lib/site";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  if (siteFromHost(h.get("x-forwarded-host") ?? h.get("host")) !== "bsd") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
