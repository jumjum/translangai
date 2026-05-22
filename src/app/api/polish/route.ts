import { NextResponse } from "next/server";
import { polish, type PolishProviderId } from "@/lib/providers/polish";
import { LANGS, type Lang } from "@/lib/types";

const PROVIDERS: PolishProviderId[] = ["gemini", "claude-haiku", "groq"];

/** POST { text, lang, provider } → polished text + usage metadata. */
export async function POST(req: Request) {
  let body: { text?: string; lang?: string; provider?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const text = String(body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "missing text" }, { status: 400 });
  if (text.length > 6000) return NextResponse.json({ error: "text too long (>6000 chars)" }, { status: 413 });
  const lang = body.lang as Lang | undefined;
  if (!lang || !LANGS.includes(lang)) {
    return NextResponse.json({ error: "missing/unknown lang" }, { status: 400 });
  }
  const provider = (body.provider as PolishProviderId | undefined) ?? "gemini";
  if (!PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "unknown provider" }, { status: 400 });
  }

  const result = await polish(text, lang, provider);
  return NextResponse.json(result);
}

export async function GET() {
  // Cheap health check + lets the R&D drawer probe which providers have keys.
  return NextResponse.json({
    ok: true,
    providers: PROVIDERS,
    keys: {
      gemini: !!process.env.GEMINI_API_KEY,
      "claude-haiku": !!process.env.ANTHROPIC_API_KEY,
      groq: !!process.env.GROQ_API_KEY,
    },
  });
}
