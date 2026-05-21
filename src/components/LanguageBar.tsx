"use client";

import { useCallback, useRef, useState } from "react";
import DevBadge from "@/components/DevBadge";
import { parseLangPair } from "@/lib/langNames";
import { bumpPair, rankLangs } from "@/lib/langPairStats";
import { isSpeechRecognitionSupported } from "@/lib/speech";
import { LANG_META, type Lang } from "@/lib/types";
import { BTN_CHIP } from "@/lib/ui";
import { useClickAway } from "@/lib/useClickAway";

type Props = {
  src: Lang;
  tgt: Lang;
  onChangeSrc: (l: Lang) => void;
  onChangeTgt: (l: Lang) => void;
  onSwap: () => void;
};

/**
 * Voice-pick language pair — "polyglot" mode.
 *
 * The browser's SpeechRecognition needs a single language per session, so
 * we run sequential attempts: first in `navigator.language`, then in
 * `en-US` if the first attempt's transcript didn't parse to any known
 * language name. That covers two of the most likely speaker profiles
 * (native speaker + English speaker) on a single click.
 *
 * The alias table in `src/lib/langNames.ts` already contains language
 * names spelled in all 8 supported tongues, so a single successful
 * transcription is usually enough.
 */
function LangPairMic({
  tgt,
  onChangeSrc,
  onChangeTgt,
}: {
  tgt: Lang;
  onChangeSrc: (l: Lang) => void;
  onChangeTgt: (l: Lang) => void;
}) {
  const supported = isSpeechRecognitionSupported();
  const [listening, setListening] = useState(false);
  const recRef = useRef<{ stop: () => void; abort: () => void } | null>(null);
  const queueRef = useRef<string[]>([]);

  const tryNext = useCallback(() => {
    const lang = queueRef.current.shift();
    if (!lang || typeof window === "undefined") {
      setListening(false);
      return;
    }
    type SRWindow = Window & {
      SpeechRecognition?: new () => unknown;
      webkitSpeechRecognition?: new () => unknown;
    };
    const w = window as SRWindow;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      setListening(false);
      return;
    }
    type SREvent = { results: { [i: number]: { [j: number]: { transcript: string } }; length: number } & {
      [i: number]: { length: number };
    } };
    type SR = {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: ((e: SREvent) => void) | null;
      onend: (() => void) | null;
      onerror: ((e: unknown) => void) | null;
      start: () => void;
      stop: () => void;
      abort: () => void;
    };
    const r = new SR() as unknown as SR;
    r.lang = lang;
    r.continuous = false;
    r.interimResults = false;
    r.maxAlternatives = 3;

    let matched = false;
    r.onresult = (e: SREvent) => {
      // Walk every alternative across every result for the best chance of a hit.
      const candidates: string[] = [];
      for (let i = 0; i < e.results.length; i++) {
        const result = e.results[i];
        for (let j = 0; j < result.length; j++) {
          candidates.push(result[j].transcript);
        }
      }
      for (const txt of candidates) {
        const { src: ns, tgt: nt } = parseLangPair(txt);
        if (ns || nt) {
          matched = true;
          if (ns) onChangeSrc(ns);
          if (nt) onChangeTgt(nt);
          if (ns) bumpPair(ns, nt ?? tgt);
          queueRef.current = [];
          setListening(false);
          try { r.stop(); } catch { /* already stopping */ }
          return;
        }
      }
    };
    r.onend = () => {
      if (!matched) {
        if (queueRef.current.length > 0) tryNext();
        else setListening(false);
      }
    };
    r.onerror = () => {
      if (queueRef.current.length > 0) tryNext();
      else setListening(false);
    };

    recRef.current = {
      stop: () => { try { r.stop(); } catch { /* noop */ } },
      abort: () => { try { r.abort(); } catch { /* noop */ } },
    };
    try { r.start(); } catch { tryNext(); }
  }, [onChangeSrc, onChangeTgt, tgt]);

  const start = () => {
    if (!supported) return;
    const browserLang =
      typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US";
    // Polyglot ladder: try the browser locale first, then English (if different).
    const attempts = [browserLang];
    if (!/^en/i.test(browserLang)) attempts.push("en-US");
    queueRef.current = attempts;
    setListening(true);
    tryNext();
  };

  const stop = () => {
    queueRef.current = [];
    recRef.current?.abort();
    setListening(false);
  };

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={() => (listening ? stop() : start())}
      aria-pressed={listening}
      aria-label={listening ? "Listening for language pair…" : "Voice-pick language pair"}
      title={
        listening
          ? "Listening… say a pair like 'Swedish to English' or 'русский на английский'"
          : "Voice-pick language pair (polyglot — say it in any of the 8 supported languages)"
      }
      className={`relative grid h-8 w-8 place-items-center rounded-full active:scale-95 ${BTN_CHIP}`}
    >
      {listening && (
        <span className="absolute inset-0 animate-ping rounded-full bg-zinc-900/20 dark:bg-zinc-100/25" />
      )}
      <svg className="relative h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3z" stroke="currentColor" strokeWidth="2" />
        <path d="M19 12a7 7 0 01-14 0M12 19v3M8 22h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <DevBadge n="V" label="voice-pair" position="tr" />
    </button>
  );
}

/**
 * Language picker chip. Two-column dropdown sorted by usage frequency.
 *
 * Click opens. Click an option picks. Outside click / Escape closes.
 * Mouse movement does nothing.
 */
function LangChip({
  lang,
  side,
  open,
  onToggle,
  onClose,
  onPick,
  excluded,
  label,
}: {
  lang: Lang;
  side: "src" | "tgt";
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onPick: (l: Lang) => void;
  excluded?: Lang;
  label: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useClickAway(wrapRef, open, onClose);

  // Compute the sort only when the dropdown opens — avoids reading localStorage
  // on every render of every chip on every keystroke.
  const ranked = open ? rankLangs(side) : [];

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${LANG_META[lang].name}`}
        className={`group inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium active:scale-[0.98] ${BTN_CHIP}`}
      >
        <span className="text-base leading-none">{LANG_META[lang].flag}</span>
        <span>{LANG_META[lang].native}</span>
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          className={`opacity-60 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute left-0 top-full z-30 mt-2 w-[19rem] grid grid-cols-2 gap-0 overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-xl ring-1 ring-zinc-900/5 dark:border-zinc-700 dark:bg-zinc-900 dark:ring-white/5"
        >
          {ranked.map((l) => (
            <button
              key={l}
              type="button"
              disabled={l === excluded}
              onClick={() => onPick(l)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-800 ${
                l === lang
                  ? "bg-zinc-900 text-zinc-50 hover:bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-100"
                  : ""
              }`}
              role="option"
              aria-selected={l === lang}
            >
              <span className="text-base">{LANG_META[l].flag}</span>
              <span className="truncate">{LANG_META[l].native}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LanguageBar({ src, tgt, onChangeSrc, onChangeTgt, onSwap }: Props) {
  const [open, setOpen] = useState<"src" | "tgt" | null>(null);
  const close = () => setOpen(null);

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <LangPairMic tgt={tgt} onChangeSrc={onChangeSrc} onChangeTgt={onChangeTgt} />
      <LangChip
        lang={src}
        side="src"
        label="Source language"
        open={open === "src"}
        onToggle={() => setOpen(open === "src" ? null : "src")}
        onClose={close}
        excluded={tgt}
        onPick={(l) => {
          onChangeSrc(l);
          bumpPair(l, tgt);
          close();
        }}
      />
      <button
        type="button"
        onClick={() => {
          onSwap();
          bumpPair(tgt, src);
        }}
        aria-label="Swap languages and text"
        title="Swap source ↔ target (and their text)"
        className={`grid h-8 w-8 place-items-center rounded-full active:scale-95 ${BTN_CHIP}`}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <path
            d="M3 4h8m0 0L8 1m3 3L8 7M11 10H3m0 0l3 3m-3-3l3-3"
            stroke="currentColor"
            strokeWidth="1.4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <LangChip
        lang={tgt}
        side="tgt"
        label="Target language"
        open={open === "tgt"}
        onToggle={() => setOpen(open === "tgt" ? null : "tgt")}
        onClose={close}
        excluded={src}
        onPick={(l) => {
          onChangeTgt(l);
          bumpPair(src, l);
          close();
        }}
      />
    </div>
  );
}
