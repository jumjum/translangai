// Translation-session history.
//
// Sessions ≥ 2 minutes long are persisted to localStorage so the user can
// revisit transcriptions / translations / summaries later — similar to a
// chat-history sidebar in LLM apps.
//
// Storage: localStorage key "translangai:history" → JSON array, newest first.
// Cap: 50 sessions (older entries evicted on save).
//
// Reactivity: `saveSession`, `updateSession`, `deleteSession`, `clearHistory`
// all dispatch a `translangai:history` `CustomEvent` on `window` so any
// mounted panel can refresh its view.

import type { Lang } from "./types";

const STORAGE_KEY = "translangai:history";
const MAX_SESSIONS = 50;
const HISTORY_EVENT = "translangai:history";

export type Session = {
  id: string;
  createdAt: number;          // unix ms — session start
  durationMs: number;         // wall-clock active time
  src: Lang;
  tgt: Lang;
  transcription: string;      // source-language text
  translation: string;        // target-language text
  summary?: string;
  summaryProvider?: "llm" | "extractive";
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function emitChange() {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(HISTORY_EVENT));
}

/** Subscribe to history changes. Returns an unsubscribe function. */
export function onHistoryChange(cb: () => void): () => void {
  if (!isBrowser()) return () => {};
  const handler = () => cb();
  window.addEventListener(HISTORY_EVENT, handler);
  return () => window.removeEventListener(HISTORY_EVENT, handler);
}

/** Load all sessions, newest first. */
export function loadSessions(): Session[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Session[];
    if (!Array.isArray(arr)) return [];
    return arr;
  } catch {
    return [];
  }
}

function writeAll(sessions: Session[]) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  } catch {
    // localStorage full or disabled — silent
  }
  emitChange();
}

/** Persist a brand-new session. Returns its generated id. */
export function saveSession(input: Omit<Session, "id">): string {
  const id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const session: Session = { id, ...input };
  const existing = loadSessions();
  writeAll([session, ...existing]);
  return id;
}

/** Patch an existing session (e.g. attach a summary that arrived later). */
export function updateSession(id: string, patch: Partial<Omit<Session, "id">>): void {
  const all = loadSessions();
  const idx = all.findIndex((s) => s.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], ...patch };
  writeAll(all);
}

/** Remove a single session. */
export function deleteSession(id: string): void {
  const all = loadSessions().filter((s) => s.id !== id);
  writeAll(all);
}

/** Wipe everything. */
export function clearHistory(): void {
  writeAll([]);
}

// ---------------------------------------------------------------------------
// Formatters — pure, easy to unit-test if we want later.
// ---------------------------------------------------------------------------

/** Compact duration: "2m 14s" / "1h 03m" / "45s". */
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

/** "Today 14:32" / "Yesterday 09:15" / "May 18 14:32". */
export function formatWhen(unixMs: number, now: number = Date.now()): string {
  const d = new Date(unixMs);
  const nowD = new Date(now);
  const sameDay =
    d.getFullYear() === nowD.getFullYear() &&
    d.getMonth() === nowD.getMonth() &&
    d.getDate() === nowD.getDate();
  const y = new Date(now - 86_400_000);
  const yesterday =
    d.getFullYear() === y.getFullYear() &&
    d.getMonth() === y.getMonth() &&
    d.getDate() === y.getDate();
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  if (sameDay) return `Today ${hh}:${mm}`;
  if (yesterday) return `Yesterday ${hh}:${mm}`;
  const month = d.toLocaleString(undefined, { month: "short" });
  return `${month} ${d.getDate()} ${hh}:${mm}`;
}
