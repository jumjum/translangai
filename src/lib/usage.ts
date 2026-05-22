// Client-side usage stats — every paid API call appends an entry here so
// the R&D dashboard can show a running tally of tokens, cost, and call
// counts. Pure localStorage; no network leaves the device.
//
// We deliberately keep this client-side for now: no auth, no real users
// yet. When we add accounts (DESIGN §18 Pro tier), we'll mirror this on
// the server for cross-device sync.

"use client";

import { useEffect, useState } from "react";

export type UsageEntry = {
  ts: number;             // epoch ms
  endpoint: "polish" | "translate" | "summarize";
  provider: string;       // 'gemini' / 'claude-haiku' / 'deepl' / etc.
  model?: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  words: number;          // word-count of the *input* (for sanity)
  latencyMs: number;
  src?: string;
  tgt?: string;
};

const KEY = "translangai:usage";
const EVT = "translangai:usage-change";
const CAP = 2000; // FIFO cap so the localStorage entry stays small

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadUsage(): UsageEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as UsageEntry[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function recordUsage(e: UsageEntry) {
  if (!isBrowser()) return;
  try {
    const all = loadUsage();
    all.push(e);
    const trimmed = all.length > CAP ? all.slice(all.length - CAP) : all;
    localStorage.setItem(KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent(EVT));
  } catch {
    // localStorage full or disabled — silent
  }
}

export function clearUsage() {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent(EVT));
  } catch {
    // noop
  }
}

/** Aggregates by endpoint, by provider, totals. Pure — re-runs cheaply on
 *  every render. */
export function summariseUsage(entries: UsageEntry[]) {
  const total = {
    calls: entries.length,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    words: 0,
    latencyMs: 0,
  };
  const byProvider: Record<string, typeof total> = {};
  const byEndpoint: Record<string, typeof total> = {};
  const oneDayAgo = Date.now() - 86_400_000;
  let last24h = 0;
  for (const e of entries) {
    total.inputTokens += e.inputTokens;
    total.outputTokens += e.outputTokens;
    total.costUsd += e.costUsd;
    total.words += e.words;
    total.latencyMs += e.latencyMs;
    if (e.ts >= oneDayAgo) last24h += e.costUsd;
    const bp = (byProvider[e.provider] ??= { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, words: 0, latencyMs: 0 });
    bp.calls += 1;
    bp.inputTokens += e.inputTokens;
    bp.outputTokens += e.outputTokens;
    bp.costUsd += e.costUsd;
    bp.words += e.words;
    bp.latencyMs += e.latencyMs;
    const be = (byEndpoint[e.endpoint] ??= { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, words: 0, latencyMs: 0 });
    be.calls += 1;
    be.inputTokens += e.inputTokens;
    be.outputTokens += e.outputTokens;
    be.costUsd += e.costUsd;
    be.words += e.words;
    be.latencyMs += e.latencyMs;
  }
  return { total, byProvider, byEndpoint, last24hCostUsd: last24h };
}

/** React hook — refreshes on any recordUsage / clearUsage anywhere. */
export function useUsage(): UsageEntry[] {
  const [entries, setEntries] = useState<UsageEntry[]>([]);
  useEffect(() => {
    setEntries(loadUsage());
    const refresh = () => setEntries(loadUsage());
    window.addEventListener(EVT, refresh);
    return () => window.removeEventListener(EVT, refresh);
  }, []);
  return entries;
}
