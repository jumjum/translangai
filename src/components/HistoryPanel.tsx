"use client";

import { useEffect, useState } from "react";
import {
  type Session,
  clearHistory,
  deleteSession,
  formatDuration,
  formatWhen,
  loadSessions,
  onHistoryChange,
} from "@/lib/history";
import { LANG_META } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onLoad: (session: Session) => void;
};

/**
 * Fly-in left sidebar listing saved translation sessions, one row each.
 * Visual model: ChatGPT-style conversation list.
 *
 * Each row shows: src-flag → tgt-flag · timestamp · duration · delete-btn.
 * Click body to load the session into the LiveTranslator.
 */
export default function HistoryPanel({ open, onClose, onLoad }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);

  // Refresh whenever the panel opens or history changes elsewhere.
  useEffect(() => {
    if (!open) return;
    setSessions(loadSessions());
  }, [open]);
  useEffect(() => onHistoryChange(() => setSessions(loadSessions())), []);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-label="Translation history"
        aria-hidden={!open}
        className={`fixed left-0 top-0 z-50 flex h-dvh w-[88vw] max-w-sm flex-col border-r border-black/10 bg-white shadow-2xl transition-transform duration-200 dark:border-white/10 dark:bg-zinc-950 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          paddingTop: "max(env(safe-area-inset-top), 0px)",
          paddingBottom: "max(env(safe-area-inset-bottom), 0px)",
          paddingLeft: "max(env(safe-area-inset-left), 0px)",
        }}
      >
        <header className="flex items-center justify-between gap-2 border-b border-black/5 px-4 py-3 dark:border-white/5">
          <h2 className="text-sm font-semibold">History</h2>
          <div className="flex items-center gap-1">
            {sessions.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Clear all history? This cannot be undone.")) clearHistory();
                }}
                className="rounded-md px-2 py-1 text-[11px] text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10"
              >
                Clear all
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close history"
              className="grid h-7 w-7 place-items-center rounded-md text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10"
            >
              ✕
            </button>
          </div>
        </header>

        <p className="px-4 py-2 text-[11px] text-zinc-400">
          Sessions of 2 minutes or longer are saved automatically.
        </p>

        <ul className="flex-1 overflow-y-auto px-2 pb-3">
          {sessions.length === 0 ? (
            <li className="px-2 py-8 text-center text-xs text-zinc-400">
              No saved sessions yet.
              <br />
              Start a long live translation to see it here.
            </li>
          ) : (
            sessions.map((s) => (
              <li key={s.id} className="group">
                <div className="flex items-center gap-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
                  <button
                    type="button"
                    onClick={() => {
                      onLoad(s);
                      onClose();
                    }}
                    className="flex flex-1 items-center gap-2 truncate px-2.5 py-2 text-left"
                    title={
                      s.transcription
                        ? s.transcription.slice(0, 200)
                        : "Open session"
                    }
                  >
                    <span className="shrink-0 text-sm leading-none" aria-hidden>
                      {LANG_META[s.src].flag}
                      <span className="mx-0.5 text-zinc-400">→</span>
                      {LANG_META[s.tgt].flag}
                    </span>
                    <span className="truncate text-[12px] text-zinc-700 dark:text-zinc-300">
                      {formatWhen(s.createdAt)}
                    </span>
                    <span className="ml-auto shrink-0 rounded-md bg-black/5 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-500 dark:bg-white/10 dark:text-zinc-400">
                      {formatDuration(s.durationMs)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(s.id);
                    }}
                    aria-label="Delete session"
                    className="mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-zinc-400 opacity-60 hover:bg-zinc-900 hover:text-zinc-50 group-hover:opacity-100 dark:hover:bg-zinc-100 dark:hover:text-zinc-900"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </aside>
    </>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M9 7V4h6v3m-7 0v13a2 2 0 002 2h4a2 2 0 002-2V7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
