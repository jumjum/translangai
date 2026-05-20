import { describe, expect, it } from "vitest";
import { extractiveSummary } from "../../app/api/summarize/route";

describe("extractiveSummary (no-key fallback)", () => {
  it("returns input verbatim when text has <=3 sentences", () => {
    const t = "Hej. Hvordan har du det? Jeg er glad.";
    expect(extractiveSummary(t)).toBe(t);
  });

  it("picks first, longest middle, and last sentence", () => {
    const text = [
      "Opening sentence sets context.",
      "Tiny one.",
      "This sentence carries the densest content because it is the longest one in the passage.",
      "Filler middle sentence.",
      "Final sentence concludes neatly.",
    ].join(" ");
    const out = extractiveSummary(text);
    expect(out).toContain("Opening sentence");
    expect(out).toContain("densest content");
    expect(out).toContain("Final sentence");
    expect(out).not.toContain("Filler middle"); // not first/last/longest
  });

  it("handles single-sentence input", () => {
    expect(extractiveSummary("Just one thought.")).toBe("Just one thought.");
  });

  it("handles empty input gracefully", () => {
    expect(extractiveSummary("")).toBe("");
  });

  it("preserves sentence-ending punctuation", () => {
    const t = "First! Second? Third.";
    const out = extractiveSummary(t);
    expect(out).toMatch(/[.!?]$/);
  });
});
