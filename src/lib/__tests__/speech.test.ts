/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("speech.ts environment guards", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    // Restore window between tests
    const w = window as unknown as Record<string, unknown>;
    delete w.SpeechRecognition;
    delete w.webkitSpeechRecognition;
  });

  it("reports unsupported when neither global is present", async () => {
    const { isSpeechRecognitionSupported } = await import("../speech");
    expect(isSpeechRecognitionSupported()).toBe(false);
  });

  it("reports supported when webkitSpeechRecognition exists (iOS Safari)", async () => {
    (window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = class {};
    const { isSpeechRecognitionSupported } = await import("../speech");
    expect(isSpeechRecognitionSupported()).toBe(true);
  });

  it("isTtsSupported reflects window.speechSynthesis", async () => {
    const { isTtsSupported } = await import("../speech");
    // jsdom does not implement speechSynthesis → expect false
    expect(isTtsSupported()).toBe(false);
  });
});

describe("listVoicesForLang", () => {
  it("returns [] when speechSynthesis is unavailable (jsdom)", async () => {
    const { listVoicesForLang } = await import("../speech");
    const vs = await listVoicesForLang("en-US");
    expect(vs).toEqual([]);
  });
});
