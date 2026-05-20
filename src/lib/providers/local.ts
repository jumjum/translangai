import { seedLookupPhrase } from "../data/seed";
import type { Lang, TranslateRequest, TranslateResult } from "../types";
import type { TranslationProvider } from "./types";

/**
 * Local dictionary provider.
 *
 * Strategy (in order):
 *   1. Exact phrase match against the bundled multilingual seed.
 *   2. Tokenized word-by-word translation, passing unknown words through
 *      verbatim and labelling the result as "approximate" with coverage %.
 *
 * Phase 3 will swap the bundled seed for a real `better-sqlite3` store
 * fed from FreeDict / Wiktextract dumps — the public lookup API stays
 * the same so nothing above this layer changes.
 */
export const localProvider: TranslationProvider = {
  info: {
    id: "local",
    name: "Local dictionary",
    description: "Offline — bundled vocabulary + word-by-word fallback",
    accent: "emerald",
  },
  supports: () => true,
  async translate(req: TranslateRequest): Promise<TranslateResult> {
    const t0 = Date.now();
    const hit = seedLookupPhrase(req.src as Lang, req.tgt as Lang, req.q);
    const latency = Date.now() - t0;

    if (!hit) {
      return {
        primary: "—",
        notes: "No words matched the offline dictionary.",
        confidence: 0,
        latencyMs: latency,
        fallback: true,
      };
    }

    // Build a friendly note when the answer is an approximation.
    let notes: string | undefined;
    if (hit.partial) {
      const pct = Math.round(hit.coverage * 100);
      const missingPreview = hit.missingWords.slice(0, 3).join(", ");
      notes = `Approximate (${pct}% of words covered)${missingPreview ? ` — missing: ${missingPreview}` : ""}.`;
    }

    return {
      primary: hit.primary,
      pos: hit.pos,
      ipa: hit.ipa,
      examples: hit.examples,
      idiomatic: hit.idiom ? { equivalent: hit.primary } : undefined,
      confidence: hit.partial ? Math.max(0.3, hit.coverage) : hit.idiom ? 0.9 : 0.85,
      notes,
      latencyMs: latency,
      fallback: hit.partial, // approximate ⇒ surface the "fallback" badge in UI
    };
  },
};
