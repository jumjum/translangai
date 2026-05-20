import type { Lang, TranslateRequest, TranslateResult } from "../types";
import type { TranslationProvider } from "./types";

/**
 * Lingva provider — FREE, no key.
 *
 * Lingva is an open-source alternative front-end / proxy to Google Translate.
 * It gives you Google's translation quality with no API key and no quotas
 * worth worrying about for personal use.
 *
 * Public instances (we fall back across them):
 *   1. https://lingva.ml                 (canonical, occasionally down)
 *   2. https://lingva.lunar.icu          (community mirror)
 *   3. https://translate.plausibility.cloud
 *
 * Override with LINGVA_URL env var (e.g. self-host with the `lingva-translate`
 * Docker image) for guaranteed availability.
 */
const ENDPOINTS = [
  "https://lingva.ml",
  "https://lingva.lunar.icu",
  "https://translate.plausibility.cloud",
];

export const lingvaProvider: TranslationProvider = {
  info: {
    id: "lingva",
    name: "Lingva (Google proxy)",
    description: "Free Google Translate proxy — no key, no quota",
    accent: "violet",
  },
  supports: () => true,
  async translate(req: TranslateRequest): Promise<TranslateResult> {
    const t0 = Date.now();
    const hosts = process.env.LINGVA_URL ? [process.env.LINGVA_URL!] : ENDPOINTS;
    const path = `/api/v1/${req.src}/${req.tgt}/${encodeURIComponent(req.q)}`;

    let lastErr = "";
    for (const host of hosts) {
      try {
        const res = await fetch(`${host}${path}`, {
          method: "GET",
          // Aggressive cache — Lingva responses are deterministic for the same input.
          next: { revalidate: 86_400 },
        });
        if (!res.ok) {
          lastErr = `${host} → ${res.status}`;
          continue;
        }
        const ct = res.headers.get("content-type") ?? "";
        if (!ct.includes("application/json")) {
          // Some instances return HTML on rate-limit — skip to next host.
          lastErr = `${host} → non-JSON response`;
          continue;
        }
        const data = (await res.json()) as { translation?: string };
        if (!data.translation) {
          lastErr = `${host} → missing translation`;
          continue;
        }
        return {
          primary: data.translation,
          confidence: 0.9,
          sourceUrl: host,
          latencyMs: Date.now() - t0,
        };
      } catch (err) {
        lastErr = `${host} → ${(err as Error).message}`;
      }
    }

    return {
      primary: "—",
      notes: `Lingva instances unreachable: ${lastErr}`,
      latencyMs: Date.now() - t0,
      fallback: true,
    };
  },
};

export const LINGVA_LANGS: Lang[] = ["en", "ru", "da", "de", "sv"];
