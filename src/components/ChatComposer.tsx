"use client";

import { useRef } from "react";
import DevBadge from "@/components/DevBadge";
import { readDroppedText } from "@/lib/drop";
import { t } from "@/lib/i18n";
import { useAutoGrowTextarea } from "@/lib/segmenter";
import { LANG_META, type Lang } from "@/lib/types";
import { BTN_CHIP } from "@/lib/ui";

/**
 * Bottom chat-composer bar:
 *
 *   [ + ] [ textarea grows upward as user types ] [ 🎙 ]
 *
 * Modelled on Claude / ChatGPT composer bars. Mic lives inside the
 * composer on the right — small, with a subtle ping while listening.
 * "+" on the left opens a menu of file/camera/stream sources (currently
 * accepts text-file drops; image/audio/URL are spec'd in DESIGN §16).
 *
 * Layout intent: this whole bar sits at the very bottom of the viewport
 * in thumb-reach range; the textarea auto-grows upward up to ~14 lines.
 */
export default function ChatComposer({
  value,
  onChange,
  srcLang,
  listening,
  asrSupported,
  onToggleMic,
  onClear,
  onDropText,
}: {
  value: string;
  onChange: (v: string) => void;
  srcLang: Lang;
  listening: boolean;
  asrSupported: boolean;
  onToggleMic: () => void;
  onClear: () => void;
  onDropText?: (text: string) => void;
}) {
  const taRef = useAutoGrowTextarea(value, 14);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const pickFile = () => fileInputRef.current?.click();
  const handlePickedFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const t = await readDroppedText(files);
    if (!t) return;
    if (onDropText) onDropText(t);
    else onChange(value ? value + "\n\n" + t : t);
  };

  return (
    <div
      className="relative flex items-end gap-1.5 rounded-2xl border border-zinc-300 bg-white p-1.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
    >
      {/* + button — file / camera / stream menu (currently file picker). */}
      <button
        type="button"
        onClick={pickFile}
        aria-label="Add file"
        title="Add a file (text now · audio / camera / streams: coming)"
        className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-full ${BTN_CHIP}`}
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <DevBadge n="+" label="add" position="tl" />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.markdown,.csv,.tsv,.json,.log,.srt,.vtt,.html,.htm,text/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handlePickedFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* The textarea — auto-grows upward. */}
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t(listening ? "sourcePlaceholderListening" : "sourcePlaceholderIdle", srcLang)}
        rows={1}
        lang={LANG_META[srcLang].bcp47}
        spellCheck
        className="block min-h-[2.25rem] w-full resize-none bg-transparent px-1 py-2 text-[15px] leading-snug outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
      />

      {/* Right cluster — clear-when-text, mic always. */}
      <div className="flex shrink-0 items-end gap-1">
        {value && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear"
            className={`grid h-9 w-9 place-items-center rounded-full ${BTN_CHIP}`}
            title="Clear"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={onToggleMic}
          disabled={!asrSupported}
          aria-pressed={listening}
          aria-label={listening ? "Stop listening" : "Start listening"}
          title={listening ? "Stop" : `Dictate in ${LANG_META[srcLang].name}`}
          className={`relative grid h-9 w-9 place-items-center rounded-full transition-colors ${
            listening
              ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
              : `${BTN_CHIP}`
          }`}
        >
          {listening && (
            <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-zinc-900/20 dark:bg-zinc-100/25" />
          )}
          {listening ? (
            <svg viewBox="0 0 24 24" className="relative h-3.5 w-3.5" fill="currentColor" aria-hidden>
              <rect x="6" y="6" width="12" height="12" rx="2.5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="relative h-4 w-4" fill="none" aria-hidden>
              <path d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3z" stroke="currentColor" strokeWidth="2" />
              <path d="M19 12a7 7 0 01-14 0M12 19v3M8 22h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
          <DevBadge n={2} label="mic" position="tr" />
        </button>
      </div>
    </div>
  );
}
