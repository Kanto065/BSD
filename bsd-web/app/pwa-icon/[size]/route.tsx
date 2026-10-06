import { ImageResponse } from "next/og";
import { SITES, siteFromHost } from "@/lib/site";

// Square PWA icon, a coloured tile with a white letter chosen from the host. Only the two sizes in the manifest exist.
export async function GET(req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  if (size !== "192" && size !== "512") return new Response(null, { status: 404 });
  const px = Number(size);
  const site = SITES[siteFromHost(req.headers.get("x-forwarded-host") ?? req.headers.get("host"))];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: site.themeColor,
          color: "white",
          fontSize: px * 0.5,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        {site.letter}
      </div>
    ),
    { width: px, height: px }
  );
}
