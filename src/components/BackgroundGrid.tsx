/**
 * Fixed, behind-everything SVG that gives the app a faint circuit-board /
 * node-graph texture — Culture-series ship interior meets Trek LCARS substrate.
 *
 * Two overlapping patterns:
 *   1. `grid-dots`  — a fine 24×24 dot grid (chip substrate noise)
 *   2. `traces`     — a sparser 144×144 pattern of L-shaped trace lines with
 *      a node at every bend (the actual "circuit" feel)
 *
 * Color is inherited via `currentColor` from a `text-…/[0.0X]` class so the
 * pattern automatically retints for light vs. dark mode.
 */
export default function BackgroundGrid() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full text-zinc-900/[0.08] dark:text-zinc-100/[0.07]"
      preserveAspectRatio="none"
    >
      <defs>
        <pattern id="grid-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="0" cy="0" r="0.6" fill="currentColor" />
        </pattern>
        <pattern id="traces" x="0" y="0" width="144" height="144" patternUnits="userSpaceOnUse">
          {/* L-trace */}
          <path
            d="M0 36 H48 V12 H96"
            stroke="currentColor"
            strokeWidth="0.6"
            fill="none"
          />
          <circle cx="48" cy="36" r="1.6" fill="currentColor" />
          <circle cx="48" cy="12" r="1.6" fill="currentColor" />
          {/* T-trace, opposite quadrant */}
          <path
            d="M72 96 H120 M96 72 V120"
            stroke="currentColor"
            strokeWidth="0.6"
            fill="none"
          />
          <circle cx="96" cy="96" r="1.6" fill="currentColor" />
          {/* Lone pad */}
          <rect x="20" y="100" width="3" height="3" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid-dots)" />
      <rect width="100%" height="100%" fill="url(#traces)" />
    </svg>
  );
}
