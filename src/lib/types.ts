// Core domain types — referenced everywhere.

export const LANGS = ["en", "ru", "da", "de", "sv"] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_META: Record<
  Lang,
  { name: string; native: string; flag: string; bcp47: string; tts: string }
> = {
  en: { name: "English", native: "English", flag: "🇬🇧", bcp47: "en-US", tts: "en-US" },
  ru: { name: "Russian", native: "Русский", flag: "🇷🇺", bcp47: "ru-RU", tts: "ru-RU" },
  da: { name: "Danish",  native: "Dansk",    flag: "🇩🇰", bcp47: "da-DK", tts: "da-DK" },
  de: { name: "German",  native: "Deutsch",  flag: "🇩🇪", bcp47: "de-DE", tts: "de-DE" },
  sv: { name: "Swedish", native: "Svenska",  flag: "🇸🇪", bcp47: "sv-SE", tts: "sv-SE" },
};

export type TranslateRequest = {
  q: string;
  src: Lang;
  tgt: Lang;
};

export type IdiomBreakdown = {
  equivalent: string;
  literal?: string;
  note?: string;
};

export type ExamplePair = { src: string; tgt: string };

export type TranslateResult = {
  primary: string;
  alternatives?: string[];
  idiomatic?: IdiomBreakdown;
  examples?: ExamplePair[];
  pos?: string;
  ipa?: string;
  confidence?: number;
  sourceUrl?: string;
  notes?: string;
  latencyMs: number;
  /** True when the provider could not answer and a fallback filled in. */
  fallback?: boolean;
};

export type ProviderId =
  | "deepl"        // paid (key)
  | "local"        // free, offline
  | "llm"          // paid (key) — Anthropic
  | "thesaurus"    // paid (key) — Anthropic
  | "mymemory"     // free, no key (~1k words/day anon)
  | "libre"        // free, no key (self-hostable for unlimited)
  | "lingva";      // free, no key — Google Translate proxy

/** Providers that may incur API costs (require keys). Used by "Free mode". */
export const PAID_PROVIDERS: ProviderId[] = ["deepl", "llm", "thesaurus"];
export const FREE_PROVIDERS: ProviderId[] = ["local", "mymemory", "libre", "lingva"];

export type ProviderInfo = {
  id: ProviderId;
  name: string;
  description: string;
  /** Subtle accent shown in the panel header. */
  accent: string;
};
