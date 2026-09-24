import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Brand navy and teal, sampled from the client's logo.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0C2E42",
          color: "white",
          fontSize: 100,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        B
        <div style={{ width: 84, height: 12, marginTop: 4, background: "#219E89", borderRadius: 6 }} />
      </div>
    ),
    size
  );
}
