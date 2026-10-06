import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { buildManifest, siteFromHost } from "@/lib/site";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const h = await headers();
  return buildManifest(siteFromHost(h.get("x-forwarded-host") ?? h.get("host")));
}
