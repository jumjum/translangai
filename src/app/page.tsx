"use client";

import { useEffect, useState } from "react";
import LiveTranslator from "@/components/LiveTranslator";
import CompareView from "@/components/CompareView";
import HistoryPanel from "@/components/HistoryPanel";
import DevBadge from "@/components/DevBadge";
import DevLinksDrawer from "@/components/DevLinksDrawer";
import type { Session } from "@/lib/history";
import type { Lang } from "@/lib/types";
import { BTN_CHIP, BTN_CHIP_ACTIVE } from "@/lib/ui";

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
            className={`relative grid h-9 w-9 place-items-center rounded-xl active:scale-95 ${BTN_CHIP}`}
          >
            <HistoryIcon className="h-4 w-4" />
            <DevBadge n="H" label="history" />
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

      <footer className="flex items-center justify-between gap-3 pt-2 text-[11px] text-zinc-400">
        <span className="hidden sm:inline">web · mobile · voice via Web Speech · Tauri desktop coming</span>
        <span className="sm:hidden">web · mobile · voice · desktop coming</span>
        <DevLinksDrawer />
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
  const tab = (id: "live" | "compare", label: string) => {
    const active = mode === id;
    return (
      <button
        type="button"
        onClick={() => setMode(id)}
        aria-pressed={active}
        className={`rounded-full px-3 py-1.5 text-xs font-medium ${
          active ? BTN_CHIP_ACTIVE : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        }`}
      >
        {label}
      </button>
    );
  };
  return (
    <div className={`relative inline-flex rounded-full p-1 ${BTN_CHIP}`}>
      {tab("live", "Live")}
      {tab("compare", "Compare")}
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
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${
        freeMode ? BTN_CHIP : BTN_CHIP_ACTIVE
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          freeMode ? "bg-zinc-500 dark:bg-zinc-400" : "bg-zinc-50 dark:bg-zinc-900"
        }`}
      />
      {freeMode ? "FREE" : "PAID"}
    </button>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-zinc-600 via-zinc-700 to-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(0,0,0,0.25)] ring-1 ring-zinc-400/40 dark:ring-zinc-300/30"
      >
        {/* Hairline inner frame — gives the chip a "machined" edge */}
        <span className="pointer-events-none absolute inset-[2px] rounded-[9px] border border-zinc-400/35" />
        {/* Culture-glyph: two arc brackets + center node + IO traces */}
        <svg viewBox="0 0 64 64" className="relative h-6 w-6" fill="none" aria-hidden>
          <path d="M 26 18 Q 18 32 26 46" stroke="#fafafa" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M 38 18 Q 46 32 38 46" stroke="#fafafa" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="32" cy="32" r="2.2" fill="#fafafa" />
          <line x1="10" y1="32" x2="18" y2="32" stroke="#fafafa" strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
          <line x1="46" y1="32" x2="54" y2="32" stroke="#fafafa" strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
          <circle cx="10" cy="32" r="1.3" fill="#fafafa" />
          <circle cx="54" cy="32" r="1.3" fill="#fafafa" />
        </svg>
      </span>
      <div className="flex flex-col leading-tight">
        <h1 className="bg-gradient-to-b from-zinc-700 to-zinc-950 bg-clip-text text-base font-bold tracking-tight text-transparent sm:text-lg dark:from-zinc-100 dark:to-zinc-400">
          TransLang&nbsp;AI
        </h1>
        <span className="system-label hidden text-zinc-500 sm:inline">omni · translator</span>
      </div>
    </div>
  );
}
