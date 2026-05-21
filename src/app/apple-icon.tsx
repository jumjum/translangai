import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS "Add to Home Screen" icon — abstract Culture-glyph, no Latin letters. */
export default function AppleIcon() {
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
          border: "3px solid rgba(161,161,170,0.5)",
          borderRadius: 0,
        }}
      >
        <svg width="128" height="128" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <path d="M 26 18 Q 18 32 26 46" stroke="#fafafa" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path d="M 38 18 Q 46 32 38 46" stroke="#fafafa" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <circle cx="32" cy="32" r="2.6" fill="#fafafa" />
          <line x1="8" y1="32" x2="18" y2="32" stroke="#fafafa" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <line x1="46" y1="32" x2="56" y2="32" stroke="#fafafa" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <circle cx="8" cy="32" r="1.5" fill="#fafafa" />
          <circle cx="56" cy="32" r="1.5" fill="#fafafa" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
