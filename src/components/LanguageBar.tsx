"use client";

import { useEffect, useRef, useState } from "react";
import DevBadge from "@/components/DevBadge";
import { parseLangPair } from "@/lib/langNames";
import { isSpeechRecognitionSupported, useSpeechRecognition } from "@/lib/speech";
import { LANGS, LANG_META, type Lang } from "@/lib/types";
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
 * Voice-detect language pair.
 *
 * Listens in the browser's locale (or current source-lang as fallback) and
 * parses the transcript for known language names — "swedish to english",
 * "español inglés", "русский немецкий", etc. Updates src/tgt as soon as a
 * pair is detected. Single-language detections only change src.
 */
function LangPairMic({
  src,
  onChangeSrc,
  onChangeTgt,
}: {
  src: Lang;
  onChangeSrc: (l: Lang) => void;
  onChangeTgt: (l: Lang) => void;
}) {
  const supported = isSpeechRecognitionSupported();
  // Use the browser's locale by default — it's the language the user is most
  // comfortable speaking. Falls back to the current source lang.
  const recogLang =
    typeof navigator !== "undefined" && navigator.language
      ? navigator.language
      : LANG_META[src].bcp47;
  const speech = useSpeechRecognition(recogLang);
  const finalRef = useRef("");

  // When recognition produces text, try to extract a language pair from it.
  useEffect(() => {
    const txt = speech.finalText.trim();
    if (!txt || txt === finalRef.current) return;
    finalRef.current = txt;
    const { src: newSrc, tgt: newTgt } = parseLangPair(txt);
    if (newSrc) onChangeSrc(newSrc);
    if (newTgt) onChangeTgt(newTgt);
    if (newSrc || newTgt) speech.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.finalText]);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={() => {
        if (speech.listening) {
          speech.stop();
        } else {
          finalRef.current = "";
          speech.reset();
          speech.start();
        }
      }}
      aria-pressed={speech.listening}
      aria-label={
        speech.listening
          ? "Listening for language pair…"
          : "Voice-pick language pair"
      }
      title={
        speech.listening
          ? "Say a pair, e.g. 'Swedish to English'"
          : "Voice-pick language pair — say e.g. 'Spanish to English'"
      }
      className={`relative grid h-8 w-8 place-items-center rounded-full active:scale-95 ${BTN_CHIP}`}
    >
      {speech.listening && (
        <span className="absolute inset-0 animate-ping rounded-full bg-zinc-900/20 dark:bg-zinc-100/25" />
      )}
      <svg className="relative h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3z"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M19 12a7 7 0 01-14 0M12 19v3M8 22h8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <DevBadge n="V" label="voice-pair" position="tr" />
    </button>
  );
}

/**
 * Language picker chip with click-to-open dropdown.
 *
 * Click opens, click-outside or Escape closes, click-option picks.
 * Mouse movement does NOT close — once committed, the dropdown stays
 * until the user makes a deliberate gesture.
 */
function LangChip({
  lang,
  open,
  onToggle,
  onClose,
  onPick,
  excluded,
  label,
}: {
  lang: Lang;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onPick: (l: Lang) => void;
  excluded?: Lang;
  label: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useClickAway(wrapRef, open, onClose);

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
          className="absolute left-0 top-full z-30 mt-2 w-48 overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-xl ring-1 ring-zinc-900/5 dark:border-zinc-700 dark:bg-zinc-900 dark:ring-white/5"
        >
          {LANGS.map((l) => (
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
              <span className="flex-1">{LANG_META[l].native}</span>
              <span className="text-xs opacity-50">{LANG_META[l].name}</span>
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
      <LangPairMic src={src} onChangeSrc={onChangeSrc} onChangeTgt={onChangeTgt} />
      <LangChip
        lang={src}
        label="Source language"
        open={open === "src"}
        onToggle={() => setOpen(open === "src" ? null : "src")}
        onClose={close}
        excluded={tgt}
        onPick={(l) => {
          onChangeSrc(l);
          close();
        }}
      />
      <button
        type="button"
        onClick={onSwap}
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
        label="Target language"
        open={open === "tgt"}
        onToggle={() => setOpen(open === "tgt" ? null : "tgt")}
        onClose={close}
        excluded={src}
        onPick={(l) => {
          onChangeTgt(l);
          close();
        }}
      />
    </div>
  );
}
