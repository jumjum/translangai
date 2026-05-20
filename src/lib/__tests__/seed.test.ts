import { describe, expect, it } from "vitest";
import { ROWS, SEED, seedLookup, seedLookupPhrase } from "../data/seed";
import { LANGS } from "../types";

describe("seed dictionary", () => {
  it("includes all 5 supported languages as source keys", () => {
    for (const l of LANGS) {
      expect(SEED[l], `missing source language ${l}`).toBeDefined();
    }
  });

  it("does basic lookups EN → all targets", () => {
    expect(seedLookup("en", "da", "hello")?.primary).toBe("hej");
    expect(seedLookup("en", "de", "hello")?.primary).toBe("hallo");
    expect(seedLookup("en", "ru", "hello")?.primary).toBe("привет");
    expect(seedLookup("en", "sv", "hello")?.primary).toBe("hej");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(seedLookup("en", "sv", "  HELLO  ")?.primary).toBe("hej");
  });

  it("looks up Swedish source words", () => {
    expect(seedLookup("sv", "en", "hej")?.primary).toBe("hello");
    expect(seedLookup("sv", "de", "tack")?.primary).toBe("danke");
    expect(seedLookup("sv", "ru", "bok")?.primary).toBe("книга");
  });

  it("maps idioms to local equivalents, not literal translations", () => {
    const breakLeg = seedLookup("en", "sv", "break a leg");
    expect(breakLeg?.primary).toBe("lycka till");
    expect(breakLeg?.idiom).toBe(true);

    const raining = seedLookup("en", "de", "it's raining cats and dogs");
    expect(raining?.primary).toBe("es regnet Bindfäden");
    expect(raining?.idiom).toBe(true);
  });

  it("returns null on misses (so callers can fall back)", () => {
    expect(seedLookup("en", "sv", "supercalifragilistic")).toBeNull();
  });

  it("returns example sentences when available", () => {
    const r = seedLookup("en", "sv", "hello");
    expect(r?.examples?.[0]?.src).toContain("Hello");
    expect(r?.examples?.[0]?.tgt).toContain("Hej");
  });

  it("respects aliases (e.g. 'hi' → same row as 'hello')", () => {
    expect(seedLookup("en", "sv", "hi")?.primary).toBe("hej");
    expect(seedLookup("en", "da", "thanks")?.primary).toBe("tak");
  });

  it("has a non-trivial vocabulary (>=80 rows)", () => {
    expect(ROWS.length).toBeGreaterThanOrEqual(80);
  });
});

describe("seedLookupPhrase — multi-word tokenized fallback", () => {
  it("returns the same as exact match when the whole phrase is known", () => {
    const r = seedLookupPhrase("en", "sv", "break a leg");
    expect(r?.primary).toBe("lycka till");
    expect(r?.partial).toBe(false);
    expect(r?.coverage).toBe(1);
  });

  it("translates multi-word inputs word-by-word", () => {
    const r = seedLookupPhrase("en", "da", "hello car");
    expect(r).not.toBeNull();
    expect(r!.primary).toBe("hej bil");
    expect(r!.partial).toBe(false);
    expect(r!.coverage).toBe(1);
  });

  it("passes unknown words through verbatim and marks the result partial", () => {
    const r = seedLookupPhrase("en", "da", "hello qwertyx");
    expect(r).not.toBeNull();
    expect(r!.primary).toContain("hej");
    expect(r!.primary).toContain("qwertyx");
    expect(r!.partial).toBe(true);
    expect(r!.coverage).toBeCloseTo(0.5, 2);
    expect(r!.missingWords).toEqual(["qwertyx"]);
  });

  it("preserves punctuation between words", () => {
    const r = seedLookupPhrase("en", "da", "hello, friend!");
    expect(r?.primary).toBe("hej, ven!");
  });

  it("handles a mix of stop-words & content for any language pair", () => {
    // EN → RU: "I want water" → "я хотеть вода" (rough, but exists)
    const r = seedLookupPhrase("en", "ru", "I want water");
    expect(r?.primary.toLowerCase()).toContain("я");
    expect(r?.primary.toLowerCase()).toContain("вода");
  });

  it("returns null only when no word matches at all", () => {
    expect(seedLookupPhrase("en", "sv", "zzzz foozzz barzzz")).toBeNull();
  });

  it("works in all language directions for known words", () => {
    const pairs: [string, string, string, string][] = [
      ["en", "ru", "house", "дом"],
      ["ru", "en", "дом", "house"],
      ["da", "sv", "tak", "tack"],
      ["sv", "de", "tack", "danke"],
      ["de", "da", "Haus", "hus"],
      ["en", "sv", "first stage", "första scen"],
    ];
    for (const [src, tgt, q, expected] of pairs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = seedLookupPhrase(src as any, tgt as any, q);
      expect(r, `lookup ${src}→${tgt} "${q}"`).not.toBeNull();
      expect(r!.primary.toLowerCase()).toContain(expected.toLowerCase());
    }
  });
});
