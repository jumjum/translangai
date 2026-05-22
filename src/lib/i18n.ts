// Tiny in-field placeholder localiser.
//
// Scope: ONLY the placeholders inside the text fields (source + target +
// transcript). The rest of the chrome (button labels, system labels) stays
// English for now — it's set once and the same English words appear in the
// muscle memory of every translator app. The strings users actually *read*
// every time they look at an empty field, those follow the language.
//
// Add new keys as needed; missing translations fall back to English.

import type { Lang } from "./types";

type Key =
  | "sourcePlaceholderIdle"     // "Type or talk…"
  | "sourcePlaceholderListening" // "Listening — speak now…"
  | "liveTranscriptListening"   // "Listening…" (live <p> when no text yet)
  | "targetPlaceholder"          // "Translation will appear here…"
  | "transcribeIdle"             // "Tap the mic to dictate, or paste/drop text here…"
  | "transcribeLabel";           // "TRANSCRIBE" badge

const STRINGS: Record<Key, Record<Lang, string>> = {
  sourcePlaceholderIdle: {
    en: "Type or talk…",
    ru: "Введите или говорите…",
    da: "Skriv eller tal…",
    de: "Tippen oder sprechen…",
    sv: "Skriv eller tala…",
    pt: "Digite ou fale…",
    pl: "Pisz lub mów…",
    es: "Escribe o habla…",
  },
  sourcePlaceholderListening: {
    en: "Listening — speak now…",
    ru: "Слушаю — говорите…",
    da: "Lytter — tal nu…",
    de: "Höre zu — sprich jetzt…",
    sv: "Lyssnar — tala nu…",
    pt: "A ouvir — fala agora…",
    pl: "Słucham — mów teraz…",
    es: "Escuchando — habla ahora…",
  },
  liveTranscriptListening: {
    en: "Listening…",
    ru: "Слушаю…",
    da: "Lytter…",
    de: "Höre zu…",
    sv: "Lyssnar…",
    pt: "A ouvir…",
    pl: "Słucham…",
    es: "Escuchando…",
  },
  targetPlaceholder: {
    en: "Translation will appear here…",
    ru: "Перевод появится здесь…",
    da: "Oversættelsen vises her…",
    de: "Die Übersetzung erscheint hier…",
    sv: "Översättningen visas här…",
    pt: "A tradução aparecerá aqui…",
    pl: "Tłumaczenie pojawi się tutaj…",
    es: "La traducción aparecerá aquí…",
  },
  transcribeIdle: {
    en: "Tap the mic to dictate, or paste/drop text here…",
    ru: "Нажмите микрофон или вставьте текст сюда…",
    da: "Tryk på mikrofonen for at diktere, eller indsæt tekst her…",
    de: "Mikrofon antippen zum Diktieren oder Text hier einfügen…",
    sv: "Tryck på mikrofonen för att diktera, eller klistra in text här…",
    pt: "Toque no microfone para ditar, ou cole texto aqui…",
    pl: "Naciśnij mikrofon, aby dyktować, lub wklej tekst…",
    es: "Toca el micrófono para dictar, o pega texto aquí…",
  },
  transcribeLabel: {
    en: "▸ TRANSCRIBE",
    ru: "▸ ТРАНСКРИПЦИЯ",
    da: "▸ TRANSSKRIPTION",
    de: "▸ TRANSKRIPTION",
    sv: "▸ TRANSKRIPTION",
    pt: "▸ TRANSCRIÇÃO",
    pl: "▸ TRANSKRYPCJA",
    es: "▸ TRANSCRIPCIÓN",
  },
};

/** Return the placeholder for `key` in the given language. Falls back to
 *  English if a translation is missing (and it shouldn't be — the map is
 *  complete for all supported langs). */
export function t(key: Key, lang: Lang): string {
  return STRINGS[key][lang] ?? STRINGS[key].en;
}
