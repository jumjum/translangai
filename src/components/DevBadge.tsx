"use client";

/**
 * Small numbered overlay shown on each interactive component during dev/test
 * so the user can refer to UI parts by number when filing feedback ("in
 * stream view, component 5 should…").
 *
 * Strictly NODE_ENV-gated — Vercel production builds never render these.
 * Local opt-out via ?nodev=1.
 *
 * Styling (v0.11): kept faint and unbacked so the badge doesn't obscure
 * the icon or text it's labelling. Positioned just outside the host
 * element's content box (small negative offset) and `pointer-events-none`
 * so it can never intercept clicks.
 */

const ENABLED = process.env.NODE_ENV !== "production";

export default function DevBadge({
  n,
  label,
  position = "tl",
}: {
  n: number | string;
  label?: string;
  position?: "tl" | "tr" | "bl" | "br";
}) {
  if (!ENABLED) return null;
  if (typeof window !== "undefined" && /[?&]nodev=1/.test(window.location.search)) return null;

  // Sit just outside the host's content box so we never sit on top of an icon.
  const pos =
    position === "tl"
      ? "-top-1 -left-1"
      : position === "tr"
        ? "-top-1 -right-1"
        : position === "bl"
          ? "-bottom-1 -left-1"
          : "-bottom-1 -right-1";

  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute ${pos} z-0 select-none rounded font-mono text-[9px] leading-none text-zinc-400/70 dark:text-zinc-500/70`}
      title={label ? `Component ${n} — ${label}` : `Component ${n}`}
    >
      {n}
    </span>
  );
}
