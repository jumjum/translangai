// Speech-recognition polish — punctuation, capitalisation, mishear-fix.
//
// Takes raw ASR output in a given language and returns the same text with
// proper punctuation + capitalisation. The prompt deliberately tells the
// model NOT to rewrite meaning — only to clean up. Returns token + cost
// metadata so the client can keep a running tally.
//
// Three backends, all priced cheap-to-cheaper:
//   - gemini-2.0-flash   (~$0.0001 per ~100-word polish — recommended default)
//   - claude-haiku-4-5   (~$0.0008 per polish — better quality)
//   - llama-3.1-8b-instant on Groq (free tier — fast but more brittle)

import type { Lang } from "../types";

export type PolishProviderId = "gemini" | "claude-haiku" | "groq";

export type PolishResult = {
  polished: string;
  provider: PolishProviderId;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  fallback?: boolean;
  notes?: string;
};

const SYSTEM = `You are a transcription-polish assistant.

The user has dictated into a speech-to-text engine. The raw output is missing punctuation, may lack capitalisation, and may contain obvious mishears.

Return the same text in the same language, but:
- Add correct punctuation (.,?!:;).
- Use correct capitalisation (sentence starts, proper nouns).
- Fix only OBVIOUS mishears using context. Be conservative — when in doubt, keep the speaker's word.
- Preserve the speaker's voice, word choices, register, slang.
- Do not add, remove, or reorder content. Do not add commentary, quotes, brackets, or formatting.

Return ONLY the corrected text on one logical block. Plain text.`;

const PRICING_PER_1M = {
  "gemini-2.0-flash": { input: 0.075, output: 0.3 },
  "claude-haiku-4-5-20251001": { input: 1.0, output: 5.0 },
  "llama-3.1-8b-instant": { input: 0, output: 0 }, // Groq free tier
} as const;

function costFor(model: keyof typeof PRICING_PER_1M, inTok: number, outTok: number): number {
  const p = PRICING_PER_1M[model];
  if (!p) return 0;
  return (inTok * p.input + outTok * p.output) / 1_000_000;
}

// ── Gemini Flash ────────────────────────────────────────────────────────────
async function polishWithGemini(text: string, lang: Lang): Promise<PolishResult> {
  const t0 = Date.now();
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return {
      polished: text,
      provider: "gemini",
      model: "gemini-2.0-flash",
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs: 0,
      fallback: true,
      notes: "No GEMINI_API_KEY set — returning input unchanged.",
    };
  }
  const model = "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const body = {
    system_instruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts: [{ text: `Language: ${lang}\n\nInput:\n${text}` }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
  };
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    return {
      polished: text,
      provider: "gemini",
      model,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs: Date.now() - t0,
      fallback: true,
      notes: `Gemini error: ${r.status}`,
    };
  }
  const data = (await r.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const polished = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? text;
  const inTok = data.usageMetadata?.promptTokenCount ?? 0;
  const outTok = data.usageMetadata?.candidatesTokenCount ?? 0;
  return {
    polished,
    provider: "gemini",
    model,
    inputTokens: inTok,
    outputTokens: outTok,
    costUsd: costFor(model, inTok, outTok),
    latencyMs: Date.now() - t0,
  };
}

// ── Claude Haiku ────────────────────────────────────────────────────────────
async function polishWithClaude(text: string, lang: Lang): Promise<PolishResult> {
  const t0 = Date.now();
  const key = process.env.ANTHROPIC_API_KEY;
  const model = "claude-haiku-4-5-20251001";
  if (!key) {
    return {
      polished: text,
      provider: "claude-haiku",
      model,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs: 0,
      fallback: true,
      notes: "No ANTHROPIC_API_KEY set — returning input unchanged.",
    };
  }
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: SYSTEM,
      messages: [{ role: "user", content: `Language: ${lang}\n\nInput:\n${text}` }],
      temperature: 0.2,
    }),
  });
  if (!r.ok) {
    return {
      polished: text,
      provider: "claude-haiku",
      model,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs: Date.now() - t0,
      fallback: true,
      notes: `Claude error: ${r.status}`,
    };
  }
  const data = (await r.json()) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const polished = data.content?.find((b) => b.type === "text")?.text?.trim() ?? text;
  const inTok = data.usage?.input_tokens ?? 0;
  const outTok = data.usage?.output_tokens ?? 0;
  return {
    polished,
    provider: "claude-haiku",
    model,
    inputTokens: inTok,
    outputTokens: outTok,
    costUsd: costFor(model, inTok, outTok),
    latencyMs: Date.now() - t0,
  };
}

// ── Groq Llama ──────────────────────────────────────────────────────────────
async function polishWithGroq(text: string, lang: Lang): Promise<PolishResult> {
  const t0 = Date.now();
  const key = process.env.GROQ_API_KEY;
  const model = "llama-3.1-8b-instant";
  if (!key) {
    return {
      polished: text,
      provider: "groq",
      model,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs: 0,
      fallback: true,
      notes: "No GROQ_API_KEY set — returning input unchanged.",
    };
  }
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Language: ${lang}\n\nInput:\n${text}` },
      ],
      temperature: 0.2,
      max_tokens: 2048,
    }),
  });
  if (!r.ok) {
    return {
      polished: text,
      provider: "groq",
      model,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs: Date.now() - t0,
      fallback: true,
      notes: `Groq error: ${r.status}`,
    };
  }
  const data = (await r.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const polished = data.choices?.[0]?.message?.content?.trim() ?? text;
  const inTok = data.usage?.prompt_tokens ?? 0;
  const outTok = data.usage?.completion_tokens ?? 0;
  return {
    polished,
    provider: "groq",
    model,
    inputTokens: inTok,
    outputTokens: outTok,
    costUsd: costFor(model, inTok, outTok),
    latencyMs: Date.now() - t0,
  };
}

export async function polish(
  text: string,
  lang: Lang,
  provider: PolishProviderId,
): Promise<PolishResult> {
  if (!text.trim()) {
    return {
      polished: text,
      provider,
      model: "",
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs: 0,
      fallback: true,
      notes: "Empty input.",
    };
  }
  if (provider === "claude-haiku") return polishWithClaude(text, lang);
  if (provider === "groq") return polishWithGroq(text, lang);
  return polishWithGemini(text, lang);
}
