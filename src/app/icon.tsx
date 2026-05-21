import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0a0a0b",
          color: "#fafafa",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          fontWeight: 800,
          borderRadius: 7,
          letterSpacing: -1,
          fontFamily: "system-ui, -apple-system, sans-serif",
          border: "1px solid #27272a",
        }}
      >
        T→T
      </div>
    ),
    { ...size },
  );
}
