"use client";

import { useRef, useState } from "react";
import { LANG_META, type Lang } from "@/lib/types";
import { BTN_CHIP, BTN_CHIP_ACTIVE } from "@/lib/ui";
import { useClickAway } from "@/lib/useClickAway";
import DevBadge from "@/components/DevBadge";

/**
 * Split-button that fuses the "auto-speak" toggle and the voice-picker
 * dropdown so we save horizontal toolbar space.
 *
 * Layout: [ 🔊 on/off ] | [ voice ▾ ]
 * Left half toggles auto-speak (aria-pressed). Right half opens a popover
 * to pick a system voice for the current target language.
 */
type Props = {
  voices: SpeechSynthesisVoice[];
  voiceURI: string | undefined;
  onPickVoice: (uri: string | undefined) => void;
  autoSpeak: boolean;
  onToggleAutoSpeak: () => void;
  ttsSupported: boolean;
  tgt: Lang;
};

export default function VoiceControl({
  voices,
  voiceURI,
  onPickVoice,
  autoSpeak,
  onToggleAutoSpeak,
  ttsSupported,
  tgt,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useClickAway(wrapRef, open, () => setOpen(false));

  const sorted = [...voices].sort((a, b) => {
    if (a.localService !== b.localService) return a.localService ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const selected = voices.find((v) => v.voiceURI === voiceURI);
  const selectedLabel = selected
    ? `${selected.name}${selected.localService ? "" : " (cloud)"}`
    : "Auto";

  return (
    <div ref={wrapRef} className="relative inline-flex">
      {/* Single rounded pill, two halves with a divider between. */}
      <div className={`relative flex items-stretch rounded-full overflow-hidden ${BTN_CHIP}`}>
        {/* Left half: speaker on/off toggle. */}
        <button
          type="button"
          onClick={onToggleAutoSpeak}
          disabled={!ttsSupported}
          aria-pressed={autoSpeak}
          aria-label={autoSpeak ? "Auto-speak on (click to mute)" : "Auto-speak off (click to enable)"}
          title={
            ttsSupported
              ? autoSpeak
                ? "Auto-speak ON · click to mute (use headphones to avoid feedback)"
                : "Auto-speak OFF · click to enable"
              : "TTS not supported"
          }
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium ${
            autoSpeak ? `m-[-1px] rounded-l-full ${BTN_CHIP_ACTIVE}` : ""
          } disabled:opacity-40`}
        >
          <SpeakerIcon className="h-3.5 w-3.5" muted={!autoSpeak} />
          <span className="sr-only">auto-speak</span>
          <DevBadge n={9} label="auto" position="tl" />
        </button>

        {/* Vertical divider between halves. */}
        <span aria-hidden className="my-1 w-px self-stretch bg-zinc-400/40 dark:bg-zinc-500/30" />

        {/* Right half: voice picker. */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={!ttsSupported || voices.length === 0}
          aria-haspopup="listbox"
          aria-expanded={open}
          title={`Pick a ${LANG_META[tgt].name} voice from your device`}
          className="inline-flex max-w-[8rem] items-center gap-1 px-2.5 py-1.5 text-xs font-medium disabled:opacity-40"
        >
          <span className="truncate">{selectedLabel}</span>
          <svg
            width="9"
            height="6"
            viewBox="0 0 10 6"
            className={`opacity-60 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
          <DevBadge n={8} label="voice" position="tr" />
        </button>
      </div>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full z-30 mt-2 w-64 max-h-[60vh] overflow-y-auto rounded-xl border border-zinc-300 bg-white shadow-xl ring-1 ring-zinc-900/5 dark:border-zinc-700 dark:bg-zinc-900 dark:ring-white/5"
        >
          <button
            type="button"
            onClick={() => {
              onPickVoice(undefined);
              setOpen(false);
            }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
              !voiceURI ? "bg-zinc-100 dark:bg-zinc-800" : ""
            }`}
          >
            <span className="rounded border border-zinc-300 bg-zinc-50 px-1 font-mono text-[10px] uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              AUTO
            </span>
            <span>{LANG_META[tgt].native} · let the OS pick</span>
          </button>
          {sorted.map((v) => (
            <button
              key={v.voiceURI}
              type="button"
              onClick={() => {
                onPickVoice(v.voiceURI);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                voiceURI === v.voiceURI ? "bg-zinc-100 dark:bg-zinc-800" : ""
              }`}
            >
              <span className="shrink-0 rounded border border-zinc-300 bg-zinc-50 px-1 font-mono text-[10px] uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                {v.localService ? "DEV" : "CLD"}
              </span>
              <span className="flex-1 truncate">{v.name}</span>
              <span className="shrink-0 text-[10px] uppercase tracking-wider text-zinc-400">
                {v.lang}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SpeakerIcon({ className, muted }: { className?: string; muted?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 9v6h4l5 4V5L8 9H4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {!muted && (
        <path d="M16 8a5 5 0 010 8M19 5a9 9 0 010 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      )}
      {muted && <path d="M16 9l6 6m0-6l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
  );
}
