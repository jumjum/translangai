"use client";

import { useEffect, useRef } from "react";
import { LANG_META, type Lang } from "@/lib/types";
import { isSpeechRecognitionSupported, useSpeechRecognition } from "@/lib/speech";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** When provided, render a mic-to-text button that recognizes in this language. */
  micLang?: Lang;
};

export default function SearchInput({ value, onChange, placeholder, micLang }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const speech = useSpeechRecognition(micLang ? LANG_META[micLang].bcp47 : "en-US");
  const baseRef = useRef<string>(""); // text already in the box before this dictation started

  // Auto-resize the textarea up to 6 lines.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 6 * 28) + "px";
  }, [value]);

  // Mirror speech transcription into the input value.
  useEffect(() => {
    if (!speech.listening && !speech.liveText) return;
    if (!speech.liveText) return;
    const next = (baseRef.current + (baseRef.current ? " " : "") + speech.liveText).trim();
    onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.liveText, speech.listening]);

  function toggleMic() {
    if (speech.listening) {
      speech.stop();
    } else {
      baseRef.current = value.trim();
      speech.reset();
      speech.start();
    }
  }

  const showMic = !!micLang && isSpeechRecognitionSupported();

  return (
    <div className="relative rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-400/20 transition-colors">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          placeholder ?? (speech.listening ? "Listening — speak now…" : "Type a word, phrase, or idiom…")
        }
        rows={1}
        className="block w-full resize-none bg-transparent px-4 py-3.5 pr-24 text-lg leading-7 outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
        spellCheck
        autoFocus
      />

      {/* right-side actions */}
      <div className="absolute right-2 top-2 flex items-center gap-1">
        {value && (
          <button
            type="button"
            onClick={() => {
              if (speech.listening) speech.stop();
              speech.reset();
              baseRef.current = "";
              onChange("");
            }}
            aria-label="Clear"
            className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:bg-black/5 dark:hover:bg-white/10"
          >
            ✕
          </button>
        )}
        {showMic && (
          <button
            type="button"
            onClick={toggleMic}
            aria-pressed={speech.listening}
            aria-label={speech.listening ? "Stop listening" : "Speak to translate"}
            title={speech.listening ? "Stop listening" : `Speak in ${LANG_META[micLang!].name}`}
            className={`relative grid h-9 w-9 place-items-center rounded-full text-white shadow-sm transition-colors ${
              speech.listening
                ? "bg-gradient-to-br from-rose-500 to-rose-600"
                : "bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700"
            }`}
          >
            {speech.listening && (
              <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/40" />
            )}
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3z" stroke="currentColor" strokeWidth="2" />
              <path d="M19 12a7 7 0 01-14 0M12 19v3M8 22h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {speech.listening && (
        <div className="absolute bottom-1 left-4 flex items-center gap-1.5 text-[11px] text-rose-500">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
          listening in {LANG_META[micLang!].name}…
        </div>
      )}
      {speech.error && !speech.listening && (
        <div className="absolute bottom-1 left-4 text-[11px] text-rose-500">mic: {speech.error}</div>
      )}
    </div>
  );
}
