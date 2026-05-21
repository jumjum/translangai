import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS "Add to Home Screen" icon — monochrome chip-style T→T mark. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a0a0b",
          color: "#fafafa",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 80,
          fontWeight: 900,
          letterSpacing: -4,
          lineHeight: 0.9,
          fontFamily: "system-ui, -apple-system, sans-serif",
          border: "4px solid #27272a",
        }}
      >
        T→T
      </div>
    ),
    { ...size },
  );
}
