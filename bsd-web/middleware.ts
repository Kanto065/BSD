import { NextResponse, type NextRequest } from "next/server";
import { resolveRoute, siteFromHost } from "@/lib/site";
import { isHiddenRequest } from "@/lib/hidden-gate";

// Sends the card and marketplace hosts to their own placeholder sites. The bsd host passes through untouched.
export async function middleware(req: NextRequest) {
  const site = siteFromHost(req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  const result = resolveRoute(site, req.nextUrl.pathname);
  if (result.action === "next") {
    // A page hidden in /admin/site answers a real 404 (the prerendered copy would otherwise keep answering 200).
    if (site === "bsd" && (await isHiddenRequest(req.nextUrl.pathname))) {
      const url = req.nextUrl.clone();
      url.pathname = "/_hidden";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }
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
