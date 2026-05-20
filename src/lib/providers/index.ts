import type { ProviderId } from "../types";
import { deeplProvider } from "./deepl";
import { libreProvider } from "./libre";
import { lingvaProvider } from "./lingva";
import { llmProvider } from "./llm";
import { localProvider } from "./local";
import { mymemoryProvider } from "./mymemory";
import { thesaurusProvider } from "./thesaurus";
import type { TranslationProvider } from "./types";

export const PROVIDERS: Record<ProviderId, TranslationProvider> = {
  deepl: deeplProvider,
  local: localProvider,
  llm: llmProvider,
  thesaurus: thesaurusProvider,
  mymemory: mymemoryProvider,
  libre: libreProvider,
  lingva: lingvaProvider,
};

/**
 * Default 4-slot layout shown on first load.
 *
 * Free-first: 3 free sources that *almost always* answer, plus an LLM panel
 * which acts as a friendly upsell when no API key is set (shows "add a key")
 * and as the best idiom-aware source when one is.
 */
export const DEFAULT_SLOTS: ProviderId[] = ["local", "mymemory", "lingva", "llm"];

export function getProvider(id: ProviderId): TranslationProvider {
  return PROVIDERS[id];
}

export const ALL_PROVIDER_INFOS = Object.values(PROVIDERS).map((p) => p.info);
