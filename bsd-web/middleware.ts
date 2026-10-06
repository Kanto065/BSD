import { NextResponse, type NextRequest } from "next/server";
import { resolveRoute, siteFromHost } from "@/lib/site";

// Sends the card and marketplace hosts to their own placeholder sites. The bsd host passes through untouched.
export function middleware(req: NextRequest) {
  const site = siteFromHost(req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  const result = resolveRoute(site, req.nextUrl.pathname);
  if (result.action === "next") return NextResponse.next();
  if (result.action === "notFound") return new NextResponse(null, { status: 404 });
  const url = req.nextUrl.clone();
  url.pathname = result.to;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|uploads|brand/|.*\\.(?:png|jpg|jpeg|svg|gif|webp|avif|css|js|map|woff2?)$).*)",
  ],
};
