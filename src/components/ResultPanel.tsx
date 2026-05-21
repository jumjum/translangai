"use client";

import { useState } from "react";
import { ALL_PROVIDER_INFOS } from "@/lib/providers";
import type { ProviderId, TranslateResult } from "@/lib/types";

type Props = {
  providerId: ProviderId;
  onChangeProvider: (id: ProviderId) => void;
  result: TranslateResult | null;
  loading: boolean;
  error?: string;
  empty?: boolean;
};

/**
 * Section-codename labels (Culture/LCARS style) per provider id.
 * Replaces the old colored accent dots — we're monochrome now, so each
 * provider gets a 2-3 letter code chip beside its name instead.
 */
const PROVIDER_CODE: Record<string, string> = {
  local: "LDC",
  mymemory: "MMR",
  lingva: "LGV",
  libre: "LBR",
  deepl: "DPL",
  llm: "LLM",
  thesaurus: "THS",
};

/** Classify a provider failure so we can render a meaningful icon + CTA. */
function classifyFailure(result: TranslateResult | null): {
  kind: "free-mode" | "missing-key" | "network" | "no-match" | "unknown";
  message: string;
  hint?: string;
} | null {
  if (!result) return null;
  if (result.primary && result.primary !== "—") return null;
  const n = result.notes ?? "";
  if (/free mode/i.test(n)) {
    return {
      kind: "free-mode",
      message: "Blocked by Free mode",
      hint: "Disable the green chip in the header to use this paid source.",
    };
  }
  if (/API_KEY|no .*key|add .* key/i.test(n)) {
    return {
      kind: "missing-key",
      message: "API key not configured",
      hint: n.replace(/—.*$/, "").trim() || "Add the key to .env.local to enable.",
    };
  }
  if (/offline|unreachable|timeout|fetch failed|network/i.test(n)) {
    return {
      kind: "network",
      message: "Provider unreachable",
      hint: "Try another panel — this source is temporarily down.",
    };
  }
  if (/not found|no words/i.test(n)) {
    return { kind: "no-match", message: "Nothing in this source", hint: n };
  }
  return { kind: "unknown", message: "No result", hint: n || undefined };
}

function FailureBlock({ kind, message, hint }: NonNullable<ReturnType<typeof classifyFailure>>) {
  const icon =
    kind === "free-mode" ? (
      // padlock
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ) : kind === "missing-key" ? (
      // key
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <circle cx="9" cy="14" r="4" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 14h9m-3 0v3m-3-3v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ) : kind === "network" ? (
      // wifi-off
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <path d="M5 12.5a9 9 0 0114 0M8 16a5 5 0 018 0M12 20h.01M3 3l18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ) : (
      // info
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 8h.01M11 12h1v5h1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  // Everything monochrome — the icon disambiguates the kind, so tone is uniform.
  const tone =
    "text-zinc-600 dark:text-zinc-400 bg-zinc-50/70 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700";
  return (
    <div className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${tone}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>
        <span className="block text-sm font-medium">{message}</span>
        {hint && <span className="mt-0.5 block text-xs opacity-80">{hint}</span>}
      </span>
    </div>
  );
}

export default function ResultPanel({
  providerId,
  onChangeProvider,
  result,
  loading,
  error,
  empty,
}: Props) {
  const info = ALL_PROVIDER_INFOS.find((p) => p.id === providerId)!;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  return (
    <div className="relative flex h-full min-h-[180px] flex-col rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-black/5 dark:border-white/5 px-4 py-2.5">
        <span className="rounded border border-zinc-300 bg-zinc-50 px-1 font-mono text-[10px] uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {PROVIDER_CODE[info.id] ?? info.id.slice(0, 3).toUpperCase()}
        </span>
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="flex items-center gap-1 text-sm font-medium hover:opacity-80"
        >
          {info.name}
          <svg width="9" height="6" viewBox="0 0 10 6" className="opacity-50">
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
        </button>
        <span className="ml-auto text-[11px] tabular-nums text-zinc-400">
          {result?.latencyMs != null ? `${result.latencyMs} ms` : ""}
          {result?.fallback ? " · fallback" : ""}
        </span>
        {pickerOpen && (
          <div className="absolute left-3 top-11 z-10 w-56 overflow-hidden rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-lg">
            {ALL_PROVIDER_INFOS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChangeProvider(p.id);
                  setPickerOpen(false);
                }}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                  p.id === providerId ? "bg-zinc-100 dark:bg-zinc-800" : ""
                }`}
              >
                <span className="mt-0.5 shrink-0 rounded border border-zinc-300 bg-zinc-50 px-1 font-mono text-[10px] uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  {PROVIDER_CODE[p.id] ?? p.id.slice(0, 3).toUpperCase()}
                </span>
                <span>
                  <span className="block text-sm font-medium">{p.name}</span>
                  <span className="block text-xs text-zinc-500">{p.description}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 px-4 py-3 text-[15px] leading-6">
        {empty ? (
          <p className="text-zinc-400">Type something to see a translation.</p>
        ) : loading ? (
          <div className="space-y-2">
            <div className="h-5 w-3/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
          </div>
        ) : error ? (
          <FailureBlock kind="network" message="Request failed" hint={error} />
        ) : result && classifyFailure(result) ? (
          <FailureBlock {...classifyFailure(result)!} />
        ) : result ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => copy(result.primary)}
              className="group block w-full text-left"
              title="Click to copy"
            >
              <p className="text-xl font-semibold leading-snug">
                {result.primary}
                <span className="ml-2 text-xs text-zinc-400 opacity-0 group-hover:opacity-100 transition">
                  {copied ? "copied!" : "copy"}
                </span>
              </p>
            </button>
            {(result.pos || result.ipa) && (
              <p className="text-xs text-zinc-500">
                {result.pos ? <span>{result.pos}</span> : null}
                {result.pos && result.ipa ? <span> · </span> : null}
                {result.ipa ? <span className="font-mono">{result.ipa}</span> : null}
              </p>
            )}
            {result.idiomatic && (
              <div className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900/60">
                <p className="text-xs font-mono uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                  idiom
                </p>
                <p className="mt-1">
                  <span className="font-semibold">{result.idiomatic.equivalent}</span>
                </p>
                {result.idiomatic.literal && (
                  <p className="mt-0.5 text-xs text-zinc-500">literal: {result.idiomatic.literal}</p>
                )}
                {result.idiomatic.note && (
                  <p className="mt-0.5 text-xs italic text-zinc-500">{result.idiomatic.note}</p>
                )}
              </div>
            )}
            {result.alternatives && result.alternatives.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">alternatives</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {result.alternatives.map((alt, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => copy(alt)}
                        className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-xs hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      >
                        {alt}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.examples && result.examples.length > 0 && (
              <div className="space-y-1.5 border-t border-black/5 dark:border-white/5 pt-2">
                {result.examples.map((ex, i) => (
                  <div key={i} className="text-xs text-zinc-500">
                    <p>{ex.src}</p>
                    <p className="text-zinc-700 dark:text-zinc-300">→ {ex.tgt}</p>
                  </div>
                ))}
              </div>
            )}
            {result.notes && <p className="text-xs italic text-zinc-500">{result.notes}</p>}
          </div>
        ) : null}
      </div>
    </div>
  );
}
