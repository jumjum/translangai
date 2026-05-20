import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localProvider } from "../providers/local";
import { mymemoryProvider } from "../providers/mymemory";
import { libreProvider } from "../providers/libre";
import { lingvaProvider } from "../providers/lingva";
import { deeplProvider } from "../providers/deepl";
import { llmProvider } from "../providers/llm";
import { DEFAULT_SLOTS, PROVIDERS } from "../providers";
import { FREE_PROVIDERS, PAID_PROVIDERS } from "../types";

describe("provider registry", () => {
  it("registers all 7 providers", () => {
    expect(Object.keys(PROVIDERS).sort()).toEqual(
      ["deepl", "libre", "lingva", "llm", "local", "mymemory", "thesaurus"],
    );
  });

  it("default 4-slot layout is free-first", () => {
    expect(DEFAULT_SLOTS.length).toBe(4);
    // Three of four defaults should be free providers.
    const freeCount = DEFAULT_SLOTS.filter((id) => FREE_PROVIDERS.includes(id)).length;
    expect(freeCount).toBeGreaterThanOrEqual(3);
  });

  it("PAID_PROVIDERS and FREE_PROVIDERS together cover the whole registry", () => {
    const all = [...PAID_PROVIDERS, ...FREE_PROVIDERS].sort();
    const registry = Object.keys(PROVIDERS).sort();
    expect(all).toEqual(registry);
    // Sets must be disjoint.
    const intersect = PAID_PROVIDERS.filter((id) => FREE_PROVIDERS.includes(id));
    expect(intersect).toEqual([]);
  });
});

describe("localProvider", () => {
  it("returns a primary translation from seed", async () => {
    const r = await localProvider.translate({ q: "hello", src: "en", tgt: "sv" });
    expect(r.primary).toBe("hej");
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.fallback).toBeFalsy();
  });

  it("returns an idiom flag for idioms", async () => {
    const r = await localProvider.translate({ q: "break a leg", src: "en", tgt: "de" });
    expect(r.primary).toBe("Hals- und Beinbruch");
    expect(r.idiomatic).toBeDefined();
  });

  it("gracefully reports misses without throwing", async () => {
    const r = await localProvider.translate({ q: "qwertyuiop", src: "en", tgt: "sv" });
    expect(r.primary).toBe("—");
    expect(r.fallback).toBe(true);
  });
});

describe("mymemoryProvider (free)", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          responseData: { translatedText: "hej", match: 1 },
          matches: [{ translation: "hej", quality: 100 }, { translation: "Hej!", quality: 80 }],
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("calls the MyMemory endpoint and parses the response", async () => {
    const r = await mymemoryProvider.translate({ q: "hello", src: "en", tgt: "sv" });
    expect(r.primary).toBe("hej");
    expect(r.alternatives).toContain("Hej!");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const url = (globalThis.fetch as unknown as { mock: { calls: [string][] } }).mock.calls[0][0];
    expect(url).toContain("api.mymemory.translated.net");
    expect(url).toContain("langpair=en%7Csv");
  });

  it("returns a graceful fallback on HTTP error", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 503 })) as unknown as typeof fetch;
    const r = await mymemoryProvider.translate({ q: "x", src: "en", tgt: "sv" });
    expect(r.primary).toBe("—");
    expect(r.fallback).toBe(true);
  });
});

describe("libreProvider (free / self-hostable)", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ translatedText: "Hej" }), { status: 200 }),
    ) as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("posts source/target/q to the endpoint", async () => {
    const r = await libreProvider.translate({ q: "hello", src: "en", tgt: "sv" });
    expect(r.primary).toBe("Hej");
    const call = (globalThis.fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(call[0]).toContain("libretranslate");
    const body = JSON.parse(call[1].body as string);
    expect(body).toMatchObject({ q: "hello", source: "en", target: "sv", format: "text" });
  });
});

describe("lingvaProvider (free Google proxy)", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("returns the translation when an instance answers JSON", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ translation: "god morgon" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ) as unknown as typeof fetch;
    const r = await lingvaProvider.translate({ q: "good morning", src: "en", tgt: "sv" });
    expect(r.primary).toBe("god morgon");
    expect(r.fallback).toBeFalsy();
  });

  it("rolls over to the next instance when the first returns HTML", async () => {
    let call = 0;
    globalThis.fetch = vi.fn(async () => {
      call++;
      if (call === 1) {
        return new Response("<!DOCTYPE html>...", { status: 200, headers: { "content-type": "text/html" } });
      }
      return new Response(JSON.stringify({ translation: "hej" }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;
    const r = await lingvaProvider.translate({ q: "hello", src: "en", tgt: "sv" });
    expect(r.primary).toBe("hej");
    expect(call).toBeGreaterThan(1);
  });

  it("returns a graceful fallback when all instances fail", async () => {
    globalThis.fetch = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    const r = await lingvaProvider.translate({ q: "hello", src: "en", tgt: "sv" });
    expect(r.primary).toBe("—");
    expect(r.fallback).toBe(true);
    expect(r.notes).toMatch(/unreachable|→/);
  });
});

describe("paid providers fail safely without keys", () => {
  const realFetch = globalThis.fetch;
  const realEnv = { ...process.env };
  afterEach(() => {
    process.env = realEnv;
    globalThis.fetch = realFetch;
  });

  it("DeepL falls back to seed when no key is set", async () => {
    delete process.env.DEEPL_API_KEY;
    const r = await deeplProvider.translate({ q: "hello", src: "en", tgt: "sv" });
    expect(r.fallback).toBe(true);
    expect(r.notes).toContain("DEEPL_API_KEY");
  });

  it("LLM returns a no-key notice when no key is set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const r = await llmProvider.translate({ q: "hello", src: "en", tgt: "sv" });
    expect(r.fallback).toBe(true);
    expect(r.notes).toContain("ANTHROPIC_API_KEY");
  });
});
