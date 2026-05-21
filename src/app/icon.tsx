import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * 32×32 favicon — abstract Culture-glyph rendered at small size.
 * Stroke widths and dot radii are oversized so the mark stays readable
 * when the OS scales it down further (browser tab, taskbar, etc).
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg,#52525b,#3f3f46,#27272a)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 7,
          border: "1px solid rgba(161,161,170,0.5)",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <path d="M 26 18 Q 18 32 26 46" stroke="#fafafa" strokeWidth="4.2" fill="none" strokeLinecap="round" />
          <path d="M 38 18 Q 46 32 38 46" stroke="#fafafa" strokeWidth="4.2" fill="none" strokeLinecap="round" />
          <circle cx="32" cy="32" r="4.2" fill="#fafafa" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
