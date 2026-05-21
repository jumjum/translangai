"use client";

import { useEffect, useRef, useState } from "react";
import LanguageBar from "@/components/LanguageBar";
import SearchInput from "@/components/SearchInput";
import ResultPanel from "@/components/ResultPanel";
import { DEFAULT_SLOTS } from "@/lib/providers";
import type { Lang, ProviderId, TranslateResult } from "@/lib/types";

type SlotState = {
  result: TranslateResult | null;
  loading: boolean;
  error?: string;
};
const EMPTY_SLOT: SlotState = { result: null, loading: false };

type Props = {
  src: Lang;
  tgt: Lang;
  setSrc: (l: Lang) => void;
  setTgt: (l: Lang) => void;
  onSwap: () => void;
  freeMode: boolean;
  /** Shared source text — lifted to page-level so it survives mode toggles. */
  text: string;
  setText: (s: string) => void;
};

export default function CompareView({ src, tgt, setSrc, setTgt, onSwap, freeMode, text, setText }: Props) {
  const q = text;
  const setQ = setText;
  const [slots, setSlots] = useState<ProviderId[]>(DEFAULT_SLOTS);
  const [states, setStates] = useState<Record<ProviderId, SlotState>>(() => ({
    deepl: EMPTY_SLOT,
    local: EMPTY_SLOT,
    llm: EMPTY_SLOT,
    thesaurus: EMPTY_SLOT,
    mymemory: EMPTY_SLOT,
    libre: EMPTY_SLOT,
    lingva: EMPTY_SLOT,
  }));

  useEffect(() => {
    try {
      const raw = localStorage.getItem("polyglot:compare-slots");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length === 4) setSlots(arr);
      }
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem("polyglot:compare-slots", JSON.stringify(slots));
  }, [slots]);

  const debounced = useDebounced(q, 300);

  useEffect(() => {
    if (!debounced.trim()) {
      setStates((s) => {
        const next = { ...s };
        for (const id of slots) next[id] = EMPTY_SLOT;
        return next;
      });
      return;
    }
    const ac = new AbortController();
    setStates((s) => {
      const next = { ...s };
      for (const id of slots) next[id] = { result: null, loading: true };
      return next;
    });

    slots.forEach((providerId) => {
      fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, q: debounced, src, tgt, freeMode }),
        signal: ac.signal,
      })
        .then(async (r) => {
          const data = await r.json();
          if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
          setStates((s) => ({ ...s, [providerId]: { result: data.result, loading: false } }));
        })
        .catch((err: Error) => {
          if (err.name === "AbortError") return;
          setStates((s) => ({ ...s, [providerId]: { result: null, loading: false, error: err.message } }));
        });
    });
    return () => ac.abort();
  }, [debounced, src, tgt, slots, freeMode]);

  const changeSlot = (idx: number, id: ProviderId) => {
    setSlots((prev) => {
      const next = [...prev];
      next[idx] = id;
      return next;
    });
  };

  const isEmpty = q.trim().length === 0;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <LanguageBar src={src} tgt={tgt} onChangeSrc={setSrc} onChangeTgt={setTgt} onSwap={onSwap} />

      <SearchInput value={q} onChange={setQ} micLang={src} />

      <p className="text-xs text-zinc-500">
        Try: <Hint q="hello" onPick={setQ} />, <Hint q="break a leg" onPick={setQ} />,{" "}
        <Hint q="it's raining cats and dogs" onPick={setQ} />, <Hint q="piece of cake" onPick={setQ} />.
      </p>

      <section className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {slots.map((id, i) => {
          const s = states[id];
          return (
            <ResultPanel
              key={`${i}-${id}`}
              providerId={id}
              onChangeProvider={(next) => changeSlot(i, next)}
              result={s?.result ?? null}
              loading={!!s?.loading}
              error={s?.error}
              empty={isEmpty}
            />
          );
        })}
      </section>
    </div>
  );
}

function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = useState(v);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setD(v), ms);
    return () => {
      if (t.current) clearTimeout(t.current);
    };
  }, [v, ms]);
  return d;
}

function Hint({ q, onPick }: { q: string; onPick: (v: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(q)}
      className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-700 hover:bg-zinc-900 hover:text-zinc-50 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-100 dark:hover:text-zinc-900 transition-colors"
    >
      {q}
    </button>
  );
}
