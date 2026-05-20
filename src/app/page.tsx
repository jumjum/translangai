"use client";

import { useEffect, useState } from "react";
import LiveTranslator from "@/components/LiveTranslator";
import CompareView from "@/components/CompareView";
import HistoryPanel from "@/components/HistoryPanel";
import type { Session } from "@/lib/history";
import type { Lang } from "@/lib/types";

type Mode = "live" | "compare";

export default function Home() {
  const [mode, setMode] = useState<Mode>("live");
  const [src, setSrc] = useState<Lang>("en");
  const [tgt, setTgt] = useState<Lang>("da");
  /** Free mode is ON by default — friendly to first-time visitors + safe for the deployer. */
  const [freeMode, setFreeMode] = useState(true);

  // History sidebar
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadedSession, setLoadedSession] = useState<Session | null>(null);

  // Shared source text — persists across Live ↔ Compare toggles so the user
  // can flip to Compare to see what other engines say about the same input.
  const [sharedText, setSharedText] = useState("");

  // Persist shared state across reloads.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("polyglot:config");
      if (raw) {
        const cfg = JSON.parse(raw);
        if (cfg.src) setSrc(cfg.src);
        if (cfg.tgt) setTgt(cfg.tgt);
        if (cfg.mode === "live" || cfg.mode === "compare") setMode(cfg.mode);
        if (typeof cfg.freeMode === "boolean") setFreeMode(cfg.freeMode);
      }
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem("polyglot:config", JSON.stringify({ src, tgt, mode, freeMode }));
  }, [src, tgt, mode, freeMode]);

  const swap = () => {
    setSrc(tgt);
    setTgt(src);
  };

  return (
    <main
      className="mx-auto flex w-full max-w-3xl min-h-dvh flex-1 flex-col gap-4 px-4 py-4 sm:gap-5 sm:py-6 xl:max-w-6xl"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 0.75rem)",
        paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)",
        paddingLeft: "max(env(safe-area-inset-left), 1rem)",
        paddingRight: "max(env(safe-area-inset-right), 1rem)",
      }}
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            aria-label="Open history"
            title="History"
            className="grid h-9 w-9 place-items-center rounded-xl border border-black/10 bg-white shadow-sm transition-colors hover:border-indigo-400 dark:border-white/10 dark:bg-zinc-900"
          >
            <HistoryIcon className="h-4 w-4" />
          </button>
          <Logo />
        </div>
        <div className="flex items-center gap-2">
          <FreeModeChip freeMode={freeMode} setFreeMode={setFreeMode} />
          <ModeSwitch mode={mode} setMode={setMode} />
        </div>
      </header>

      {mode === "live" ? (
        <LiveTranslator
          src={src}
          tgt={tgt}
          setSrc={setSrc}
          setTgt={setTgt}
          onSwap={swap}
          freeMode={freeMode}
          loadedSession={loadedSession}
          onSessionLoaded={() => setLoadedSession(null)}
          text={sharedText}
          setText={setSharedText}
        />
      ) : (
        <CompareView
          src={src}
          tgt={tgt}
          setSrc={setSrc}
          setTgt={setTgt}
          onSwap={swap}
          freeMode={freeMode}
          text={sharedText}
          setText={setSharedText}
        />
      )}

      <footer className="pt-2 text-center text-[11px] text-zinc-400">
        MVP · web + mobile · voice in/out via Web Speech API · native macOS coming soon
      </footer>

      <HistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onLoad={(s) => {
          setMode("live"); // history rows always restore into Live mode
          setLoadedSession(s);
        }}
      />
    </main>
  );
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 12a9 9 0 109-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M3 4v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ModeSwitch({ mode, setMode }: { mode: "live" | "compare"; setMode: (m: "live" | "compare") => void }) {
  return (
    <div className="inline-flex rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-1 text-xs font-medium shadow-sm">
      <button
        type="button"
        onClick={() => setMode("live")}
        aria-pressed={mode === "live"}
        className={`rounded-full px-3 py-1.5 transition-colors ${
          mode === "live" ? "bg-indigo-500 text-white" : "text-zinc-600 dark:text-zinc-300"
        }`}
      >
        Live
      </button>
      <button
        type="button"
        onClick={() => setMode("compare")}
        aria-pressed={mode === "compare"}
        className={`rounded-full px-3 py-1.5 transition-colors ${
          mode === "compare" ? "bg-indigo-500 text-white" : "text-zinc-600 dark:text-zinc-300"
        }`}
      >
        Compare
      </button>
    </div>
  );
}

function FreeModeChip({ freeMode, setFreeMode }: { freeMode: boolean; setFreeMode: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => setFreeMode(!freeMode)}
      aria-pressed={freeMode}
      title={freeMode ? "Only free providers will be called (no API costs)." : "Paid providers (DeepL / LLM) are enabled."}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm transition-colors ${
        freeMode
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${freeMode ? "bg-emerald-500" : "bg-amber-500"}`} />
      {freeMode ? "free mode" : "paid enabled"}
    </button>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-rose-500 text-white shadow-md ring-1 ring-black/5"
      >
        {/* Subtle inner highlight */}
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/30" />
        {/* T → T mark */}
        <svg viewBox="0 0 28 28" className="relative h-5 w-5" fill="none" aria-hidden>
          <text x="3" y="11" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="900" fontSize="11" fill="currentColor">T</text>
          <path d="M10 14h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M17 11.5l3 2.5-3 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <text x="18" y="25" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="900" fontSize="11" fill="currentColor">T</text>
        </svg>
      </span>
      <div className="flex flex-col leading-tight">
        <h1 className="bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-rose-600 bg-clip-text text-base font-bold tracking-tight text-transparent sm:text-lg dark:from-indigo-400 dark:via-fuchsia-400 dark:to-rose-400">
          TransLang&nbsp;AI
        </h1>
        <span className="hidden text-[10px] text-zinc-500 sm:inline">omni-translator</span>
      </div>
    </div>
  );
}
