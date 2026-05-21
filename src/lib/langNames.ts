// Multilingual language-name lookup, used by the "voice-select language pair"
// mic on the LanguageBar.
//
// The user clicks the small mic and says e.g. "swedish to english" or
// "русский английский" or "español inglés". We pick up the transcription via
// Web Speech (in the browser's locale by default — `navigator.language`) and
// scan the result for known language names. First match → src, second → tgt.
//
// Multilingual aliases here include common spellings + native names so users
// can speak the pair in their own language and still hit the right rows.

import type { Lang } from "./types";

/** All known names per supported lang. Lowercase, ASCII-folded where useful. */
const ALIASES: Record<Lang, string[]> = {
  en: [
    "english", "engelsk", "engelska", "englisch",
    "anglais", "ingles", "inglés", "inglês",
    "angielski", "английский", "английского", "английском",
  ],
  ru: [
    "russian", "russisk", "russisch", "ryska",
    "russe", "ruso", "russo",
    "rosyjski", "русский", "русского", "русском",
  ],
  da: [
    "danish", "dansk", "danska", "dänisch",
    "danois", "danés", "dinamarquês",
    "duński", "датский", "датского",
  ],
  de: [
    "german", "tysk", "tyska", "deutsch",
    "allemand", "alemán", "alemão",
    "niemiecki", "немецкий", "немецкого",
  ],
  sv: [
    "swedish", "svensk", "svenska", "schwedisch",
    "suédois", "sueco",
    "szwedzki", "шведский", "шведского",
  ],
  pt: [
    "portuguese", "portugisisk", "portugisiska", "portugiesisch",
    "portugais", "portugués", "portugues", "português", "portugues",
    "portugalski", "португальский", "португальского",
  ],
  pl: [
    "polish", "polsk", "polska", "polnisch",
    "polonais", "polaco", "polonês",
    "polski", "польский", "польского",
  ],
  es: [
    "spanish", "spansk", "spanska", "spanisch",
    "espagnol", "español", "espanhol",
    "hiszpański", "испанский", "испанского",
  ],
};

/** Reverse index for quick word → lang lookup. Lowercase + diacritic-stripped. */
const INDEX: Record<string, Lang> = (() => {
  const out: Record<string, Lang> = {};
  for (const [lang, aliases] of Object.entries(ALIASES) as [Lang, string[]][]) {
    for (const a of aliases) {
      out[normalise(a)] = lang;
    }
  }
  return out;
})();

function normalise(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").trim();
}

/**
 * Parse "swedish to english" / "русский английский" / etc.
 *
 * Returns the first two language names found in order. If only one is found,
 * it's interpreted as the source — the caller can decide whether to keep the
 * existing target or do something else.
 */
export function parseLangPair(transcript: string): { src?: Lang; tgt?: Lang } {
  if (!transcript) return {};
  // Split on whitespace + common punctuation. Keep simple — recognition output
  // is rarely complex enough to need a real tokeniser.
  const words = transcript
    .split(/[\s.,!?;:"'()«»„""\-–—]+/u)
    .map(normalise)
    .filter(Boolean);

  const hits: Lang[] = [];
  for (const w of words) {
    const l = INDEX[w];
    if (l && !hits.includes(l)) hits.push(l);
    if (hits.length === 2) break;
  }
  if (hits.length === 0) return {};
  if (hits.length === 1) return { src: hits[0] };
  return { src: hits[0], tgt: hits[1] };
}
