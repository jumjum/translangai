import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS "Add to Home Screen" icon — gradient square, T→T translate mark. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #6366f1, #d946ef, #f43f5e)",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 86,
          fontWeight: 900,
          letterSpacing: -4,
          lineHeight: 0.9,
        }}
      >
        T→T
      </div>
    ),
    { ...size },
  );
}
