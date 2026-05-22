// User-tweakable settings, persisted to localStorage.
// Keep this file flat — every setting is a top-level key on the same object
// so reading/writing is one call. No migration logic needed; missing keys
// fall back to the defaults below.

"use client";

import { useEffect, useState } from "react";

export type PolishProviderId = "gemini" | "claude-haiku" | "groq";

export type Settings = {
  polishEnabled: boolean;
  polishAutoOnCommit: boolean;
  polishProvider: PolishProviderId;
};

const DEFAULTS: Settings = {
  polishEnabled: false,
  polishAutoOnCommit: false,
  polishProvider: "gemini",
};

const KEY = "translangai:settings";
const EVT = "translangai:settings-change";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadSettings(): Settings {
  if (!isBrowser()) return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(next: Partial<Settings>) {
  if (!isBrowser()) return;
  const merged = { ...loadSettings(), ...next };
  try {
    localStorage.setItem(KEY, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent(EVT));
  } catch {
    // localStorage full — silent
  }
}

/** React hook — re-renders on settings change (anywhere in the app). */
export function useSettings(): [Settings, (n: Partial<Settings>) => void] {
  const [s, setS] = useState<Settings>(DEFAULTS);
  useEffect(() => {
    setS(loadSettings());
    const onChange = () => setS(loadSettings());
    window.addEventListener(EVT, onChange);
    return () => window.removeEventListener(EVT, onChange);
  }, []);
  return [s, saveSettings];
}
