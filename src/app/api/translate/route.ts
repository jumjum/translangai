import { NextResponse } from "next/server";
import { translationCache } from "@/lib/cache";
import { getProvider } from "@/lib/providers";
import { LANGS, PAID_PROVIDERS, type Lang, type ProviderId, type TranslateResult } from "@/lib/types";

export const runtime = "nodejs";

function cacheKey(providerId: ProviderId, src: Lang, tgt: Lang, q: string) {
  return `${providerId}::${src}::${tgt}::${q.trim().toLowerCase()}`;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { providerId, q, src, tgt, freeMode } = (body ?? {}) as {
    providerId?: ProviderId;
    q?: string;
    src?: Lang;
    tgt?: Lang;
    freeMode?: boolean;
  };

  if (!providerId || !q || !src || !tgt) {
    return NextResponse.json(
      { error: "providerId, q, src, tgt are required" },
      { status: 400 },
    );
  }
  if (!LANGS.includes(src) || !LANGS.includes(tgt)) {
    return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  }

  // Free mode: block paid providers at the gateway so a misclick can't bill us.
  if (freeMode && PAID_PROVIDERS.includes(providerId)) {
    return NextResponse.json(
      {
        providerId,
        result: {
          primary: "—",
          notes: "Free mode is on. Disable to use paid providers (DeepL / LLM).",
          latencyMs: 0,
          fallback: true,
        } satisfies TranslateResult,
      },
      { headers: { "X-Polyglot-Cache": "blocked" } },
    );
  }

  const provider = getProvider(providerId);
  if (!provider) {
    return NextResponse.json({ error: `Unknown provider: ${providerId}` }, { status: 400 });
  }

  // Cache check.
  const key = cacheKey(providerId, src, tgt, q);
  const cached = translationCache.get(key) as TranslateResult | undefined;
  if (cached) {
    return NextResponse.json(
      { providerId, result: { ...cached, latencyMs: 0 } },
      { headers: { "X-Polyglot-Cache": "hit" } },
    );
  }

  try {
    const result = await provider.translate({ q, src, tgt });
    // Only cache "real" answers, not error fallbacks — that way transient
    // failures get retried instead of remembered.
    if (result.primary && result.primary !== "—" && !result.notes?.startsWith("error")) {
      translationCache.set(key, result);
    }
    return NextResponse.json({ providerId, result }, { headers: { "X-Polyglot-Cache": "miss" } });
  } catch (err) {
    return NextResponse.json(
      { error: `Provider ${providerId} failed: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}

/** GET /api/translate?ping=1 → cheap health check used by tests + uptime monitors. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("ping") === "1") {
    return NextResponse.json({ ok: true, cacheSize: translationCache.size() });
  }
  return NextResponse.json({ error: "POST with { providerId, q, src, tgt }" }, { status: 405 });
}
