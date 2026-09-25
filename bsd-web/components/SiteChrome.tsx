"use client";

import { usePathname } from "next/navigation";

/** Renders the public site's header or footer everywhere except the admin area, which has its own layout. */
export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  return <>{children}</>;
}
