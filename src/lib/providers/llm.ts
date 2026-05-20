import { seedLookup } from "../data/seed";
import { LANG_META, type Lang, type TranslateRequest, type TranslateResult } from "../types";
import type { TranslationProvider } from "./types";

/**
 * LLM provider — tuned for IDIOMS and figures of speech.
 * Returns structured JSON: { idiomatic, literal, note, alternatives }.
 *
 * Uses Anthropic if ANTHROPIC_API_KEY is set; else returns a graceful
 * mocked-but-useful response built from the seed dictionary so the UI
 * demos without keys.
 */
export const llmProvider: TranslationProvider = {
  info: {
    id: "llm",
    name: "LLM (idiom-aware)",
    description: "Claude — maps idioms to local equivalents",
    accent: "amber",
  },
  supports: () => true,
  async translate(req: TranslateRequest): Promise<TranslateResult> {
    const t0 = Date.now();
    const key = process.env.ANTHROPIC_API_KEY;
    const srcName = LANG_META[req.src as Lang].name;
    const tgtName = LANG_META[req.tgt as Lang].name;

    if (!key) {
      const hit = seedLookup(req.src as Lang, req.tgt as Lang, req.q);
      if (hit?.idiom && hit.primary) {
        return {
          primary: hit.primary,
          idiomatic: {
            equivalent: hit.primary,
            literal: `(literal gloss requires an LLM key)`,
            note: `Cultural equivalent in ${tgtName}.`,
          },
          confidence: 0.85,
          notes: "No ANTHROPIC_API_KEY set — showing offline idiom map.",
          latencyMs: Date.now() - t0,
          fallback: true,
        };
      }
      return {
        primary: hit?.primary ?? "—",
        notes: "No ANTHROPIC_API_KEY set — add one to enable idiom & figurative translation.",
        confidence: hit?.primary ? 0.4 : 0,
        latencyMs: Date.now() - t0,
        fallback: true,
      };
    }

    const prompt = `Translate from ${srcName} to ${tgtName}.

If the input is an idiom, proverb, or figure of speech, return the closest IDIOMATIC equivalent that a native speaker would actually use — NOT a literal translation. Also provide a literal gloss and a one-line cultural note.

If the input is a plain word or phrase, return the most natural everyday translation, plus 1–3 alternatives covering different registers or senses.

Respond ONLY with JSON matching this schema:
{
  "primary": "<best single answer>",
  "alternatives": ["...", "..."],
  "idiomatic": { "equivalent": "...", "literal": "...", "note": "..." } | null,
  "register": "neutral|formal|casual|idiom",
  "confidence": 0.0-1.0
}

Input: ${JSON.stringify(req.q)}`;

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
          max_tokens: 600,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!res.ok) {
        return {
          primary: "—",
          notes: `LLM error: ${res.status}`,
          latencyMs: Date.now() - t0,
          fallback: true,
        };
      }

      const data = (await res.json()) as {
        content: { type: string; text: string }[];
      };
      const text = data.content?.find((c) => c.type === "text")?.text ?? "{}";
      const json = JSON.parse(text.replace(/^```json\n?|\n?```$/g, "").trim());

      return {
        primary: json.primary ?? "—",
        alternatives: json.alternatives,
        idiomatic: json.idiomatic ?? undefined,
        confidence: json.confidence ?? 0.8,
        latencyMs: Date.now() - t0,
      };
    } catch (err) {
      return {
        primary: "—",
        notes: `LLM parse error: ${(err as Error).message}`,
        latencyMs: Date.now() - t0,
        fallback: true,
      };
    }
  },
};
