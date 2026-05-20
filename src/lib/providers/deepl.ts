import { seedLookup } from "../data/seed";
import type { Lang, TranslateRequest, TranslateResult } from "../types";
import type { TranslationProvider } from "./types";

// DeepL language codes
const DEEPL_CODE: Record<Lang, string> = {
  en: "EN",
  ru: "RU",
  da: "DA",
  de: "DE",
  sv: "SV",
  pt: "PT-BR",
};

export const deeplProvider: TranslationProvider = {
  info: {
    id: "deepl",
    name: "DeepL",
    description: "Neural MT — strong for DA / DE / RU",
    accent: "indigo",
  },
  supports: () => true,
  async translate(req: TranslateRequest): Promise<TranslateResult> {
    const t0 = Date.now();
    const key = process.env.DEEPL_API_KEY;

    if (!key) {
      // Graceful fallback so the UI demos without a key.
      const hit = seedLookup(req.src as Lang, req.tgt as Lang, req.q);
      return {
        primary: hit?.primary ?? "—",
        notes: "No DEEPL_API_KEY set — showing offline seed.",
        confidence: hit?.primary ? 0.7 : 0,
        latencyMs: Date.now() - t0,
        fallback: true,
      };
    }

    const endpoint = key.endsWith(":fx")
      ? "https://api-free.deepl.com/v2/translate"
      : "https://api.deepl.com/v2/translate";

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: [req.q],
        source_lang: DEEPL_CODE[req.src as Lang],
        target_lang: DEEPL_CODE[req.tgt as Lang],
      }),
    });

    if (!res.ok) {
      return {
        primary: "—",
        notes: `DeepL error: ${res.status}`,
        latencyMs: Date.now() - t0,
        fallback: true,
      };
    }

    const data = (await res.json()) as { translations: { text: string }[] };
    return {
      primary: data.translations[0]?.text ?? "—",
      confidence: 0.95,
      sourceUrl: "https://www.deepl.com/translator",
      latencyMs: Date.now() - t0,
    };
  },
};
