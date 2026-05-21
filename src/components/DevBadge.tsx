"use client";

/**
 * Small numbered overlay shown in the corner of a component, used during
 * dev/test so the user can refer to UI parts by number when filing
 * feedback ("in view 3, component 4 should…").
 *
 * Strictly gated on NODE_ENV — Vercel production builds set NODE_ENV=production
 * so these never appear on translangai.vercel.app.
 *
 * Also opt-out via ?nodev=1 query string for local screenshots / demos.
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

  const pos =
    position === "tl"
      ? "top-1 left-1"
      : position === "tr"
        ? "top-1 right-1"
        : position === "bl"
          ? "bottom-1 left-1"
          : "bottom-1 right-1";
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute ${pos} z-40 inline-flex select-none items-center gap-1 rounded-md border border-zinc-900/30 bg-zinc-900/85 px-1.5 py-0.5 font-mono text-[10px] leading-none text-zinc-50 shadow-sm dark:border-zinc-100/30 dark:bg-zinc-100/90 dark:text-zinc-900`}
      title={label ? `Component ${n} — ${label}` : `Component ${n}`}
    >
      <span className="font-bold tabular-nums">{n}</span>
      {label && <span className="opacity-70">{label}</span>}
    </span>
  );
}
