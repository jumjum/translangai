import { NextResponse } from "next/server";
import { LANGS, LANG_META, type Lang } from "@/lib/types";

export const runtime = "nodejs";

/**
 * POST /api/summarize
 * Body: { text: string, lang: Lang }
 * Returns: { summary, provider: "llm" | "extractive", wordCount }
 *
 * Uses Anthropic for a real executive summary when ANTHROPIC_API_KEY is set;
 * otherwise falls back to a deterministic 3-sentence extractive summary so
 * the feature works for free-tier deploys too.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { text, lang } = (body ?? {}) as { text?: string; lang?: Lang };
  if (!text || !lang || !LANGS.includes(lang)) {
    return NextResponse.json({ error: "text & valid lang required" }, { status: 400 });
  }

  const cleaned = text.trim();
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  const langName = LANG_META[lang].name;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      summary: extractiveSummary(cleaned),
      provider: "extractive",
      wordCount,
      note: "Heuristic summary (no ANTHROPIC_API_KEY). Add a key for an LLM-quality summary.",
    });
  }

  const prompt = `Summarize the following ${langName} text into a concise executive summary in ${langName}.
- Length: 3–5 sentences, max ~100 words.
- Capture key points, decisions, and any action items.
- Plain ${langName}, no preamble like "Here is the summary".
- Return only the summary text.

Text:
"""
${cleaned}
"""`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      return NextResponse.json(
        {
          summary: extractiveSummary(cleaned),
          provider: "extractive",
          wordCount,
          note: `LLM error ${res.status} — fell back to heuristic.`,
        },
        { status: 200 },
      );
    }
    const data = (await res.json()) as { content: { type: string; text: string }[] };
    const summary = data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
    return NextResponse.json({
      summary: summary || extractiveSummary(cleaned),
      provider: summary ? "llm" : "extractive",
      wordCount,
    });
  } catch (err) {
    return NextResponse.json({
      summary: extractiveSummary(cleaned),
      provider: "extractive",
      wordCount,
      note: `LLM fetch failed (${(err as Error).message}) — fell back to heuristic.`,
    });
  }
}

/**
 * Deterministic 3-sentence executive summary:
 * first sentence (sets context) + longest middle sentence (densest content)
 * + last sentence (typically closes/concludes). Good enough offline.
 */
export function extractiveSummary(text: string): string {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (sentences.length === 0) return text;
  if (sentences.length <= 3) return sentences.join(" ");
  const first = sentences[0];
  const last = sentences[sentences.length - 1];
  const longest = sentences.slice(1, -1).reduce((a, b) => (b.length > a.length ? b : a), "");
  return [first, longest, last].filter(Boolean).join(" ");
}
