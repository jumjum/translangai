import { LANG_META, type Lang, type TranslateRequest, type TranslateResult } from "../types";
import type { TranslationProvider } from "./types";

/**
 * Thesaurus / context provider.
 *
 * MVP: when no API key, returns a small synonym set using a heuristic LLM
 * pass (if available) or a static placeholder. Phase 2 will route to
 * thesaurus.com (EN), InfoDanish (DA), Duden (DE), Gramota (RU) via
 * specific scrapers/APIs.
 */
export const thesaurusProvider: TranslationProvider = {
  info: {
    id: "thesaurus",
    name: "Thesaurus & context",
    description: "Synonyms, register, related words",
    accent: "rose",
  },
  supports: () => true,
  async translate(req: TranslateRequest): Promise<TranslateResult> {
    const t0 = Date.now();
    const key = process.env.ANTHROPIC_API_KEY;
    const tgtName = LANG_META[req.tgt as Lang].name;

    if (!key) {
      return {
        primary: "—",
        notes: "Thesaurus needs an API key or a dedicated source (thesaurus.com / InfoDanish / Duden) — coming next.",
        latencyMs: Date.now() - t0,
        fallback: true,
      };
    }

    const prompt = `Give 3–6 ${tgtName} synonyms (or near-synonyms) for the translation of "${req.q}".

Return JSON:
{
  "primary": "<the most neutral synonym>",
  "alternatives": ["synonym 1", "synonym 2", "..."],
  "register": "neutral|formal|casual",
  "notes": "<one short line about register or nuance>"
}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 400,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) {
        return { primary: "—", notes: `Thesaurus error: ${res.status}`, latencyMs: Date.now() - t0, fallback: true };
      }
      const data = (await res.json()) as { content: { type: string; text: string }[] };
      const text = data.content?.find((c) => c.type === "text")?.text ?? "{}";
      const json = JSON.parse(text.replace(/^```json\n?|\n?```$/g, "").trim());
      return {
        primary: json.primary ?? "—",
        alternatives: json.alternatives,
        notes: json.notes,
        latencyMs: Date.now() - t0,
      };
    } catch (err) {
      return {
        primary: "—",
        notes: `Thesaurus parse error: ${(err as Error).message}`,
        latencyMs: Date.now() - t0,
        fallback: true,
      };
    }
  },
};
