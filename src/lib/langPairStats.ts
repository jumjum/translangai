// Tracks how often each (src, tgt) language pair is selected so the
// LanguageBar dropdowns can put the user's most-used languages at the top.
//
// Persisted to localStorage. No PII, no network — just counts.
//
// Counts are cumulative; we never decay. If the user wants a clean slate
// they can clear site data. (TODO: add a reset entry to the R&D drawer.)

import { LANGS, type Lang } from "./types";

const KEY = "translangai:pair-counts";

type Counts = Record<string, number>; // key: `${src}>${tgt}`

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function load(): Counts {
  if (!isBrowser()) return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Counts) : {};
  } catch {
    return {};
  }
}

function save(counts: Counts) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(counts));
  } catch {
    // localStorage full or disabled — silent
  }
}

/** Increment the count for the (src, tgt) pair. Called on every deliberate
 *  language change (chip pick, swap button). Safe to call repeatedly. */
export function bumpPair(src: Lang, tgt: Lang): void {
  if (src === tgt) return;
  const counts = load();
  const k = `${src}>${tgt}`;
  counts[k] = (counts[k] ?? 0) + 1;
  save(counts);
}

/** Return all LANGS sorted by total usage on the given side (src or tgt)
 *  with a stable LANGS-order tie-break, so a fresh install still shows
 *  English / Russian / Danish / … in the deterministic default order. */
export function rankLangs(side: "src" | "tgt"): Lang[] {
  const counts = load();
  const score: Partial<Record<Lang, number>> = {};
  for (const [k, n] of Object.entries(counts)) {
    const [s, t] = k.split(">") as [Lang, Lang];
    const lang = side === "src" ? s : t;
    score[lang] = (score[lang] ?? 0) + n;
  }
  const arr = [...LANGS];
  arr.sort((a, b) => {
    const diff = (score[b] ?? 0) - (score[a] ?? 0);
    if (diff !== 0) return diff;
    return LANGS.indexOf(a) - LANGS.indexOf(b);
  });
  return arr;
}
