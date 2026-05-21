"use client";

import { useState } from "react";
import { LANGS, LANG_META, type Lang } from "@/lib/types";

type Props = {
  src: Lang;
  tgt: Lang;
  onChangeSrc: (l: Lang) => void;
  onChangeTgt: (l: Lang) => void;
  onSwap: () => void;
};

function LangChip({
  lang,
  open,
  onOpen,
  onPick,
  excluded,
  label,
}: {
  lang: Lang;
  open: boolean;
  onOpen: () => void;
  onPick: (l: Lang) => void;
  excluded?: Lang;
  label: string;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${label}: ${LANG_META[lang].name}`}
        className="group flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5)] transition-colors hover:border-zinc-900 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] dark:hover:border-zinc-100"
      >
        <span className="text-base leading-none">{LANG_META[lang].flag}</span>
        <span>{LANG_META[lang].native}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" className="opacity-60">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute z-20 mt-2 w-44 overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          role="listbox"
        >
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              disabled={l === excluded}
              onClick={() => onPick(l)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-800 ${
                l === lang ? "bg-zinc-900 text-zinc-50 hover:bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-100" : ""
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

  return (
    <div
      className="flex items-center gap-2 sm:gap-3"
      onMouseLeave={() => setOpen(null)}
    >
      <LangChip
        lang={src}
        label="Source language"
        open={open === "src"}
        onOpen={() => setOpen(open === "src" ? null : "src")}
        excluded={tgt}
        onPick={(l) => {
          onChangeSrc(l);
          setOpen(null);
        }}
      />
      <button
        type="button"
        onClick={onSwap}
        aria-label="Swap languages"
        className="grid h-8 w-8 place-items-center rounded-full border border-zinc-300 bg-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5)] transition-colors hover:border-zinc-900 active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] dark:hover:border-zinc-100"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <path d="M3 4h8m0 0L8 1m3 3L8 7M11 10H3m0 0l3 3m-3-3l3-3" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <LangChip
        lang={tgt}
        label="Target language"
        open={open === "tgt"}
        onOpen={() => setOpen(open === "tgt" ? null : "tgt")}
        excluded={src}
        onPick={(l) => {
          onChangeTgt(l);
          setOpen(null);
        }}
      />
    </div>
  );
}
