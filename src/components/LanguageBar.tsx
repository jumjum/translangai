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
 * Voice-pick language pair — polyglot mode. Two sequential recognition
 * attempts (browser locale → en-US) so the user can speak the pair in any
 * supported language and the multilingual alias table parses it.
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
    type SREvent = {
      results: {
        [i: number]: { [j: number]: { transcript: string } } & { length: number };
        length: number;
      };
    };
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
          try { r.stop(); } catch { /* noop */ }
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
 * Combined two-column language picker.
 *
 * One dropdown serves both source and target chips. Left column = source
 * choices, middle = direction arrow (clickable to swap), right column =
 * target choices. Saves a click vs. the old "open src, pick, close, open
 * tgt, pick, close" flow. Each column is sorted by usage frequency
 * (rankLangs from langPairStats).
 *
 * Source column disables the current target lang, and vice versa — you
 * can't pick the same language for both sides (use Transcription mode
 * for that).
 */
function CombinedPicker({
  src,
  tgt,
  onChangeSrc,
  onChangeTgt,
  onSwap,
  onClose,
}: {
  src: Lang;
  tgt: Lang;
  onChangeSrc: (l: Lang) => void;
  onChangeTgt: (l: Lang) => void;
  onSwap: () => void;
  onClose: () => void;
}) {
  const srcRanked = rankLangs("src");
  const tgtRanked = rankLangs("tgt");

  return (
    <div
      role="dialog"
      aria-label="Choose language pair"
      className="absolute left-1/2 top-full z-30 mt-2 -translate-x-1/2 w-[22rem] sm:w-[26rem] overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-xl ring-1 ring-zinc-900/5 dark:border-zinc-700 dark:bg-zinc-900 dark:ring-white/5"
    >
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-zinc-200 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <span className="text-left">Source</span>
        <span aria-hidden>·</span>
        <span className="text-right">Target</span>
      </header>
      <div className="grid grid-cols-[1fr_auto_1fr]">
        {/* Left — source column */}
        <ul className="border-r border-zinc-200 dark:border-zinc-800">
          {srcRanked.map((l) => (
            <li key={`src-${l}`}>
              <button
                type="button"
                disabled={l === tgt}
                onClick={() => {
                  onChangeSrc(l);
                  bumpPair(l, tgt);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-800 ${
                  l === src
                    ? "bg-zinc-900 text-zinc-50 hover:bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-100"
                    : ""
                }`}
                role="option"
                aria-selected={l === src}
              >
                <span className="text-base leading-none">{LANG_META[l].flag}</span>
                <span className="truncate">{LANG_META[l].native}</span>
              </button>
            </li>
          ))}
        </ul>

        {/* Middle — direction arrow, click to reverse */}
        <div className="flex flex-col items-center justify-center px-2">
          <button
            type="button"
            onClick={onSwap}
            aria-label="Reverse translation direction"
            title="Reverse direction (and swap text)"
            className={`grid h-9 w-9 place-items-center rounded-full active:scale-95 ${BTN_CHIP}`}
          >
            <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden>
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
        </div>

        {/* Right — target column */}
        <ul>
          {tgtRanked.map((l) => (
            <li key={`tgt-${l}`}>
              <button
                type="button"
                disabled={l === src}
                onClick={() => {
                  onChangeTgt(l);
                  bumpPair(src, l);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-800 ${
                  l === tgt
                    ? "bg-zinc-900 text-zinc-50 hover:bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-100"
                    : ""
                }`}
                role="option"
                aria-selected={l === tgt}
              >
                <span className="text-base leading-none">{LANG_META[l].flag}</span>
                <span className="truncate">{LANG_META[l].native}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <footer className="border-t border-zinc-200 px-3 py-1.5 text-[10px] text-zinc-400 dark:border-zinc-800">
        Click a language to pick it. Click both columns to change the whole pair in one go.
        <button
          type="button"
          onClick={onClose}
          className="float-right text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Done
        </button>
      </footer>
    </div>
  );
}

function LangChip({
  lang,
  onClick,
  open,
  label,
}: {
  lang: Lang;
  onClick: () => void;
  open: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
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
  );
}

export default function LanguageBar({ src, tgt, onChangeSrc, onChangeTgt, onSwap }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useClickAway(wrapRef, open, () => setOpen(false));

  return (
    <div ref={wrapRef} className="relative flex items-center gap-1.5 sm:gap-2">
      <LangPairMic tgt={tgt} onChangeSrc={onChangeSrc} onChangeTgt={onChangeTgt} />
      <LangChip lang={src} label="Source language" open={open} onClick={() => setOpen(!open)} />
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
      <LangChip lang={tgt} label="Target language" open={open} onClick={() => setOpen(!open)} />

      {open && (
        <CombinedPicker
          src={src}
          tgt={tgt}
          onChangeSrc={onChangeSrc}
          onChangeTgt={onChangeTgt}
          onSwap={() => {
            onSwap();
            bumpPair(tgt, src);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
