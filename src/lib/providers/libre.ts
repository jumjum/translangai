import type { Lang, TranslateRequest, TranslateResult } from "../types";
import type { TranslationProvider } from "./types";

/**
 * LibreTranslate provider — FREE / self-hostable.
 *
 * Default endpoint: https://libretranslate.de (community instance; sometimes
 * requires a free key). Override via LIBRETRANSLATE_URL env var to point at
 * your own self-hosted instance (Docker one-liner — see DEPLOY.md).
 *
 * No cost. Quality is decent for EN ↔ DE/SV/DA/RU.
 */
const DEFAULT_ENDPOINT = "https://libretranslate.de/translate";

export const libreProvider: TranslationProvider = {
  info: {
    id: "libre",
    name: "LibreTranslate",
    description: "Open-source MT (self-hostable, fully free)",
    accent: "teal",
  },
  supports: () => true,
  async translate(req: TranslateRequest): Promise<TranslateResult> {
    const t0 = Date.now();
    const endpoint = process.env.LIBRETRANSLATE_URL ?? DEFAULT_ENDPOINT;
    const apiKey = process.env.LIBRETRANSLATE_API_KEY;

    const body: Record<string, string> = {
      q: req.q,
      source: req.src,
      target: req.tgt,
      format: "text",
    };
    if (apiKey) body.api_key = apiKey;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        next: { revalidate: 86_400 },
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return {
          primary: "—",
          notes: `LibreTranslate ${res.status}: ${detail.slice(0, 80) || "rate-limited (self-host for unlimited)"}`,
          latencyMs: Date.now() - t0,
          fallback: true,
        };
      }
      const data = (await res.json()) as { translatedText?: string };
      return {
        primary: data.translatedText ?? "—",
        sourceUrl: endpoint,
        latencyMs: Date.now() - t0,
      };
    } catch (err) {
      return {
        primary: "—",
        notes: `LibreTranslate offline: ${(err as Error).message}`,
        latencyMs: Date.now() - t0,
        fallback: true,
      };
    }
  },
};

export const LIBRE_LANGS: Lang[] = ["en", "ru", "da", "de", "sv"];
