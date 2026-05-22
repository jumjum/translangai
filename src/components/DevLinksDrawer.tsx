"use client";

import { useEffect, useRef, useState } from "react";
import AdminPanel from "@/components/AdminPanel";
import { BTN_CHIP } from "@/lib/ui";

/**
 * Lower-right footer drawer that collects every console / dashboard / docs
 * link we use while iterating on the app. One click to open the right tab —
 * no more digging for ports, project slugs, or provider URLs.
 *
 * Always visible (the links themselves are not secret; they go to public
 * vendor consoles you still have to log into). If you want to hide it from
 * a screenshot or demo build, ?nodev=1 in the URL.
 */

type LinkRow = { label: string; url: string; code: string; tooltip?: string };
type Section = { title: string; items: LinkRow[] };

// Repo + Vercel project slug — change here if it ever moves.
const REPO = "https://github.com/jumjum/translangai";
const VC = "https://vercel.com/kimo400-gmailcoms-projects/polyglot";

const SECTIONS: Section[] = [
  {
    title: "Environments",
    items: [
      { code: "LOC", label: "Local · :3000", url: "http://localhost:3000" },
      { code: "PRD", label: "Production", url: "https://translangai.vercel.app/" },
    ],
  },
  {
    title: "Repo",
    items: [
      { code: "GIT", label: "GitHub repo", url: REPO },
      { code: "ISS", label: "Issues", url: `${REPO}/issues` },
      { code: "PRS", label: "Pull requests", url: `${REPO}/pulls` },
      { code: "ACT", label: "Actions / CI", url: `${REPO}/actions` },
    ],
  },
  {
    title: "Vercel",
    items: [
      { code: "PRJ", label: "Project home", url: VC },
      { code: "DEP", label: "Deployments", url: `${VC}/deployments` },
      { code: "ENV", label: "Env variables", url: `${VC}/settings/environment-variables` },
      { code: "LOG", label: "Runtime logs", url: `${VC}/logs` },
      { code: "PRT", label: "Deployment protection", url: `${VC}/settings/deployment-protection` },
      { code: "DOM", label: "Domains", url: `${VC}/settings/domains` },
    ],
  },
  {
    title: "Provider keys & dashboards",
    items: [
      { code: "ANT", label: "Anthropic console", url: "https://console.anthropic.com/dashboard" },
      { code: "GEM", label: "Google AI Studio (Gemini)", url: "https://aistudio.google.com/app/apikey" },
      { code: "GRQ", label: "Groq console", url: "https://console.groq.com/keys" },
      { code: "DPL", label: "DeepL account / usage", url: "https://www.deepl.com/account/usage" },
    ],
  },
  {
    title: "Free provider docs (no key)",
    items: [
      { code: "MMR", label: "MyMemory API", url: "https://mymemory.translated.net/doc/spec.php" },
      { code: "LBR", label: "LibreTranslate", url: "https://libretranslate.com/" },
      { code: "LGV", label: "Lingva (free Google proxy)", url: "https://lingva.ml/" },
    ],
  },
  {
    title: "Current env (relative)",
    items: [
      { code: "PNG", label: "/api/translate?ping=1", url: "/api/translate?ping=1" },
      { code: "MAN", label: "/manifest.webmanifest", url: "/manifest.webmanifest" },
      { code: "SW", label: "/sw.js", url: "/sw.js" },
    ],
  },
];

export default function DevLinksDrawer() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Hide entirely if ?nodev=1 (matches DevBadge behaviour).
  const hidden = typeof window !== "undefined" && /[?&]nodev=1/.test(window.location.search);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (hidden) return null;

  const copy = (url: string) => {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(url);
      setTimeout(() => setCopied(null), 1200);
    });
  };

  return (
    <div ref={boxRef} className="pointer-events-auto relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="dev-links-panel"
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${BTN_CHIP}`}
        title="R&D quick links — environments, repo, Vercel, provider consoles"
      >
        <span aria-hidden>▸</span>
        R&D
      </button>

      {open && (
        <div
          id="dev-links-panel"
          role="dialog"
          aria-label="R&D quick links"
          className="absolute bottom-full right-0 z-40 mb-2 w-[18rem] max-h-[70dvh] overflow-y-auto rounded-xl border border-zinc-300 bg-white shadow-xl ring-1 ring-zinc-900/5 dark:border-zinc-700 dark:bg-zinc-900 dark:ring-white/5"
        >
          <header className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <h3 className="system-label text-zinc-700 dark:text-zinc-200">R&amp;D · quick links</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="grid h-6 w-6 place-items-center rounded text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              ✕
            </button>
          </header>

          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {/* Admin (settings + usage dashboard) sits at the top — it's
                what you read on every visit; the link sections below are
                infrequent reference material. */}
            <AdminPanel />

            {SECTIONS.map((s) => (
              <section key={s.title} className="px-3 py-2">
                <p className="system-label mb-1.5 text-zinc-500 dark:text-zinc-400">{s.title}</p>
                <ul className="space-y-0.5">
                  {s.items.map((it) => (
                    <li key={it.code} className="group flex items-center gap-1">
                      <a
                        href={it.url}
                        target={it.url.startsWith("http") ? "_blank" : undefined}
                        rel={it.url.startsWith("http") ? "noopener noreferrer" : undefined}
                        className="flex flex-1 items-center gap-2 truncate rounded px-1.5 py-1 text-[12px] hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        title={it.url}
                      >
                        <span className="shrink-0 rounded border border-zinc-300 bg-zinc-50 px-1 font-mono text-[9px] uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                          {it.code}
                        </span>
                        <span className="truncate text-zinc-800 dark:text-zinc-200">{it.label}</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => copy(it.url)}
                        aria-label={`Copy URL for ${it.label}`}
                        className="grid h-6 w-6 shrink-0 place-items-center rounded text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-700 group-hover:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                        title={copied === it.url ? "Copied!" : "Copy URL"}
                      >
                        {copied === it.url ? (
                          <span className="text-[10px] font-mono text-zinc-700 dark:text-zinc-200">✓</span>
                        ) : (
                          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
                            <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                            <path d="M3 11V4.5A1.5 1.5 0 0 1 4.5 3H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                          </svg>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
