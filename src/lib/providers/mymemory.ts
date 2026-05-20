import type { Lang, TranslateRequest, TranslateResult } from "../types";
import type { TranslationProvider } from "./types";

/**
 * MyMemory translation API — FREE.
 *
 * Quota: ~1000 words/day anonymous, ~10000 with an email query param (no key).
 * Docs: https://mymemory.translated.net/doc/spec.php
 *
 * No API key required — perfect for the always-free default tier.
 */
export const mymemoryProvider: TranslationProvider = {
  info: {
    id: "mymemory",
    name: "MyMemory",
    description: "Free community MT — no key, ~1k words/day",
    accent: "sky",
  },
  supports: () => true,
  async translate(req: TranslateRequest): Promise<TranslateResult> {
    const t0 = Date.now();
    const langpair = `${req.src}|${req.tgt}`;
    const email = process.env.MYMEMORY_EMAIL;
    const params = new URLSearchParams({ q: req.q, langpair });
    if (email) params.set("de", email); // bumps quota to ~10k words/day

    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?${params.toString()}`, {
        method: "GET",
        // Cache for 24h at the CDN/edge — MyMemory's responses are deterministic.
        next: { revalidate: 86_400 },
      });
      if (!res.ok) {
        return {
          primary: "—",
          notes: `MyMemory error: ${res.status}`,
          latencyMs: Date.now() - t0,
          fallback: true,
        };
      }
      const data = (await res.json()) as {
        responseData?: { translatedText?: string; match?: number };
        matches?: { translation: string; quality: string | number }[];
        responseStatus?: number | string;
      };
      const primary = data.responseData?.translatedText ?? "—";
      const alternatives = (data.matches ?? [])
        .map((m) => m.translation)
        .filter((s, i, arr) => s && s !== primary && arr.indexOf(s) === i)
        .slice(0, 4);
      return {
        primary,
        alternatives,
        confidence: data.responseData?.match,
        sourceUrl: "https://mymemory.translated.net",
        latencyMs: Date.now() - t0,
      };
    } catch (err) {
      return {
        primary: "—",
        notes: `MyMemory fetch failed: ${(err as Error).message}`,
        latencyMs: Date.now() - t0,
        fallback: true,
      };
    }
  },
};

// Lang-code mapping is identity for our 6 langs — MyMemory uses ISO 639-1.
// Exported so tests can verify supported pairs.
export const MYMEMORY_LANGS: Lang[] = ["en", "ru", "da", "de", "sv", "pt"];
