import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Brand navy and teal, sampled from the client's logo.
export default function Icon() {
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
          borderRadius: 6,
          color: "white",
          fontSize: 18,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        B
        <div style={{ width: 16, height: 3, marginTop: 1, background: "#219E89", borderRadius: 2 }} />
      </div>
    ),
    size
  );
}
