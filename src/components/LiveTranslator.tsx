"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LanguageBar from "@/components/LanguageBar";
import DevBadge from "@/components/DevBadge";
import VoiceControl from "@/components/VoiceControl";
import { saveSession, updateSession, type Session } from "@/lib/history";
import {
  groupSentencesIntoParagraphs,
  pairParagraphs,
  splitSentences,
  useAutoGrowTextarea,
  useStickyBottom,
} from "@/lib/segmenter";
import {
  isIos,
  isSpeechRecognitionSupported,
  isTtsSupported,
  listVoicesForLang,
  speak,
  stopSpeaking,
  useSpeechRecognition,
} from "@/lib/speech";
import { LANG_META, type Lang, type TranslateResult } from "@/lib/types";
import { BTN_CHIP, BTN_CHIP_ACTIVE, BTN_HERO } from "@/lib/ui";

/** Layout variant — determines how source/translation are rendered. */
type View = "split" | "paragraph" | "stream";
const VIEW_STORAGE_KEY = "translangai:view";

type Props = {
  src: Lang;
  tgt: Lang;
  setSrc: (l: Lang) => void;
  setTgt: (l: Lang) => void;
  onSwap: () => void;
  freeMode: boolean;
  /** A history entry the user wants to view. Populated then acked via onSessionLoaded. */
  loadedSession?: Session | null;
  onSessionLoaded?: () => void;
  /** Shared source text — lifted to page-level so it survives Live ↔ Compare toggles. */
  text: string;
  setText: (s: string) => void;
};

/** Sessions ≥ this many ms are auto-saved to history on stop. */
const HISTORY_MIN_MS = 120_000; // 2 minutes

/** Free chain — used while free mode is on. */
const FREE_CHAIN = ["mymemory", "lingva", "libre", "local"] as const;
/** Paid chain — LLM first (idiom-aware), then free fallbacks. */
const PAID_CHAIN = ["llm", "mymemory", "lingva", "libre", "local"] as const;

const SUMMARY_THRESHOLD_WORDS = 500;

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export default function LiveTranslator({
  src,
  tgt,
  setSrc,
  setTgt,
  onSwap,
  freeMode,
  loadedSession,
  onSessionLoaded,
  text,
  setText,
}: Props) {
  const speech = useSpeechRecognition(LANG_META[src].bcp47);
  const { pause: pauseListening, resume: resumeListening } = speech;
  const [translation, setTranslation] = useState<TranslateResult | null>(null);
  const [translating, setTranslating] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Voice picker
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string | undefined>(undefined);

  // Executive summary state
  const [summary, setSummary] = useState<{ text: string; provider: string; note?: string } | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  const lastSpokenRef = useRef("");
  const lastSpeakAtRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // History session tracking — wall-clock from mic-start to stop.
  const sessionStartRef = useRef<number | null>(null);
  const savedSessionIdRef = useRef<string | null>(null);
  // When loading a session from history, suppress the next auto-translate.
  const skipNextTranslateRef = useRef(false);

  // View selector — split / paragraph / stream — persisted per device.
  const [view, setView] = useState<View>("split");
  useEffect(() => {
    const saved = (typeof localStorage !== "undefined" && localStorage.getItem(VIEW_STORAGE_KEY)) as View | null;
    if (saved === "split" || saved === "paragraph" || saved === "stream") setView(saved);
  }, []);
  useEffect(() => {
    if (typeof localStorage !== "undefined") localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  // Auto-grow ref for the manual-text input (Split view).
  const taRef = useAutoGrowTextarea(text);

  // ── Smart swap ───────────────────────────────────────────────────────────
  // Reverse button on the LanguageBar now also reverses the *text*: the current
  // translation becomes the new source, and the translation re-runs in the
  // opposite direction. Cleaner mental model than "just flip the chips and
  // wonder why the text didn't move."
  const swapWithText = useCallback(() => {
    const tgtText = translation?.primary && translation.primary !== "—" ? translation.primary : "";
    if (tgtText) setText(tgtText);
    onSwap();
  }, [translation, setText, onSwap]);

  const ttsSupported = isTtsSupported();
  const asrSupported = isSpeechRecognitionSupported();

  // While listening, the live recogniser is the source of truth; otherwise the
  // shared text (page-level state, survives Live ↔ Compare toggles) is.
  const sourceText = speech.listening ? speech.liveText : text;

  // Mirror committed speech (finalText) into the shared text so when the user
  // switches to Compare mid-session, they keep what's been heard so far.
  useEffect(() => {
    if (!speech.listening) return;
    if (speech.finalText && speech.finalText !== text) setText(speech.finalText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.finalText, speech.listening]);

  // Refresh voice list when the target language changes.
  useEffect(() => {
    listVoicesForLang(LANG_META[tgt].tts).then((vs) => {
      setVoices(vs);
      // Restore persisted choice if still available; otherwise auto-pick first.
      const saved = localStorage.getItem(`translangai:voice:${tgt}`);
      if (saved && vs.some((v) => v.voiceURI === saved)) {
        setVoiceURI(saved);
      } else {
        setVoiceURI(undefined); // "Auto" — let `speak()` pick best
      }
    });
  }, [tgt]);

  const pickVoice = (uri: string | undefined) => {
    setVoiceURI(uri);
    if (uri) localStorage.setItem(`translangai:voice:${tgt}`, uri);
    else localStorage.removeItem(`translangai:voice:${tgt}`);
  };

  // Translate on every meaningful change (debounced).
  useEffect(() => {
    const text = sourceText.trim();
    if (!text) {
      setTranslation(null);
      setSummary(null);
      return;
    }
    // When restoring a session from history, the translation is already known —
    // don't re-call the API.
    if (skipNextTranslateRef.current) {
      skipNextTranslateRef.current = false;
      return;
    }
    const id = setTimeout(() => doTranslate(text), 220);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceText, src, tgt]);

  async function doTranslate(text: string) {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setTranslating(true);

    async function call(providerId: string): Promise<TranslateResult> {
      const r = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, q: text, src, tgt, freeMode }),
        signal: ac.signal,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      return data.result as TranslateResult;
    }

    try {
      const chain = freeMode ? FREE_CHAIN : PAID_CHAIN;
      let res: TranslateResult | null = null;
      for (const provider of chain) {
        res = await call(provider);
        if (res?.primary && res.primary !== "—") break;
      }
      if (!res) res = { primary: "—", latencyMs: 0, fallback: true };
      setTranslation(res);

      // Auto-speak final translation when speaker has paused.
      // Only speak if (a) the user is in a true pause (no interim),
      // (b) the output is not just an extension of what we last spoke, and
      // (c) at least 1.2s have elapsed since the last auto-speak.
      if (autoSpeak && speech.interim.length === 0 && res.primary) {
        const last = lastSpokenRef.current;
        const next = res.primary;
        const isExtension =
          last && next.length >= last.length && next.startsWith(last);
        const enoughDelta = Math.abs(next.length - last.length) > 4;
        if (next !== last && (!isExtension || enoughDelta)) {
          const now = Date.now();
          if (now - lastSpeakAtRef.current > 1200) {
            lastSpokenRef.current = next;
            lastSpeakAtRef.current = now;
            startSpeaking(next);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setTranslation({ primary: "—", notes: (err as Error).message, latencyMs: 0, fallback: true });
      }
    } finally {
      setTranslating(false);
    }
  }

  // Restart recognition when source language changes mid-listening.
  useEffect(() => {
    if (speech.listening) {
      speech.stop();
      const id = setTimeout(() => speech.start(), 80);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // 🔇 Anti-echo: while TTS is playing, suspend recognition so the mic
  // does not pick up the device's own speaker and re-translate it.
  useEffect(() => {
    if (isSpeaking) pauseListening();
    else resumeListening();
  }, [isSpeaking, pauseListening, resumeListening]);

  // Track listening transitions for: (1) session timing, (2) summary, (3) history save.
  const lastListening = useRef(false);
  useEffect(() => {
    const wasListening = lastListening.current;
    lastListening.current = speech.listening;

    // Just started — mark session start time.
    if (!wasListening && speech.listening) {
      sessionStartRef.current = Date.now();
      savedSessionIdRef.current = null;
    }

    // Just stopped.
    if (wasListening && !speech.listening) {
      const startedAt = sessionStartRef.current;
      sessionStartRef.current = null;
      const duration = startedAt ? Date.now() - startedAt : 0;

      // (1) Save to history if it was a real session (≥ 2 minutes).
      if (startedAt && duration >= HISTORY_MIN_MS) {
        const id = saveSession({
          createdAt: startedAt,
          durationMs: duration,
          src,
          tgt,
          transcription: speech.finalText.trim(),
          translation: translation?.primary && translation.primary !== "—" ? translation.primary : "",
        });
        savedSessionIdRef.current = id;
      }

      // (2) Summary for long translations (independent of history threshold).
      const final = translation?.primary;
      if (final && final !== "—" && wordCount(final) >= SUMMARY_THRESHOLD_WORDS) {
        void requestSummary(final);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.listening]);

  // When the summary arrives, patch the saved history entry (if any).
  useEffect(() => {
    if (!summary || !savedSessionIdRef.current) return;
    updateSession(savedSessionIdRef.current, {
      summary: summary.text,
      summaryProvider: summary.provider === "llm" ? "llm" : "extractive",
    });
  }, [summary]);

  // ─── Load a saved session from history ─────────────────────────────────────
  // When the user clicks a row in the HistoryPanel, the parent passes the
  // session in via `loadedSession`. Hydrate UI from it and skip auto-translate.
  useEffect(() => {
    if (!loadedSession) return;
    // Stop any active listening / speaking.
    if (speech.listening) speech.stop();
    stopSpeaking();
    setIsSpeaking(false);

    // Sync language pair at the parent level if it differs.
    if (loadedSession.src !== src) setSrc(loadedSession.src);
    if (loadedSession.tgt !== tgt) setTgt(loadedSession.tgt);

    // Clear live recogniser state, then hydrate the shared text.
    speech.reset();
    skipNextTranslateRef.current = true;
    setText(loadedSession.transcription);
    setTranslation({
      primary: loadedSession.translation || "—",
      latencyMs: 0,
      fallback: !loadedSession.translation,
    });
    setSummary(
      loadedSession.summary
        ? { text: loadedSession.summary, provider: loadedSession.summaryProvider ?? "extractive" }
        : null,
    );
    // Don't accidentally update *this* session as if a new one — clear the saved-id.
    savedSessionIdRef.current = null;

    onSessionLoaded?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedSession]);

  async function requestSummary(text: string) {
    setSummarizing(true);
    try {
      const r = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang: tgt }),
      });
      const data = await r.json();
      if (data.summary) {
        setSummary({ text: data.summary, provider: data.provider ?? "extractive", note: data.note });
      }
    } catch {
      // silent — summary is a bonus, not critical
    } finally {
      setSummarizing(false);
    }
  }

  const startSpeaking = useCallback(
    (text: string) => {
      stopSpeaking();
      speak(text, LANG_META[tgt].tts, {
        voiceURI,
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    },
    [tgt, voiceURI],
  );

  function toggleTts() {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      return;
    }
    if (!translation?.primary || translation.primary === "—") return;
    startSpeaking(translation.primary);
  }

  function clearAll() {
    if (isSpeaking) stopSpeaking();
    setIsSpeaking(false);
    speech.reset();
    setText("");
    setTranslation(null);
    setSummary(null);
    lastSpokenRef.current = "";
    lastSpeakAtRef.current = 0;
    sessionStartRef.current = null;
    savedSessionIdRef.current = null;
  }

  const tgtText = translation?.primary && translation.primary !== "—" ? translation.primary : "";

  // ── Shared button cluster (mic + speaker + clear) ────────────────────────
  // Rendered into different positions per view (middle for Split, top for
  // Paragraph/Stream). Memoised by JSX, not React.memo — components are cheap.
  const controlCluster = (
    <div className="relative flex items-center justify-center gap-5">
      {/* Speaker / Stop-speaking */}
      <button
        type="button"
        onClick={toggleTts}
        disabled={!ttsSupported || (!isSpeaking && !tgtText)}
        aria-label={isSpeaking ? "Stop speaking" : "Speak the translation"}
        aria-pressed={isSpeaking}
        className={`relative grid h-12 w-12 place-items-center rounded-full active:scale-95 ${BTN_CHIP}`}
      >
        {isSpeaking ? <StopIcon className="h-5 w-5" /> : <SpeakerIcon className="h-5 w-5" />}
        <DevBadge n={3} label="speak" />
      </button>

      {/* Mic / Stop-listening — hero element */}
      <button
        type="button"
        onClick={speech.toggle}
        disabled={!asrSupported}
        aria-pressed={speech.listening}
        aria-label={speech.listening ? "Stop listening" : "Start listening"}
        className={`relative grid h-20 w-20 place-items-center rounded-full active:scale-95 ${BTN_HERO}`}
      >
        {/* Inner highlight ring — chip socket feel */}
        <span aria-hidden className="pointer-events-none absolute inset-1.5 rounded-full border border-zinc-100/15 dark:border-zinc-900/15" />
        {speech.listening && (
          <span className="absolute inset-0 animate-ping rounded-full bg-zinc-900/20 dark:bg-zinc-100/25" />
        )}
        {speech.listening ? <StopIcon className="relative h-9 w-9" /> : <MicIcon className="relative h-8 w-8" />}
        <DevBadge n={2} label="mic" />
      </button>

      {/* Clear */}
      <button
        type="button"
        onClick={clearAll}
        aria-label="Clear all"
        className={`relative grid h-12 w-12 place-items-center rounded-full active:scale-95 ${BTN_CHIP}`}
      >
        <TrashIcon className="h-5 w-5" />
        <DevBadge n={4} label="clear" />
      </button>
    </div>
  );

  // ── Source field — used by Split view ─────────────────────────────────────
  // Wrapped in a min-height container so toggling between the live transcript
  // <p> and the editable <textarea> doesn't visually shrink the source pane.
  const sourceField = (
    <div className="min-h-[4.5rem]">
      {speech.listening ? (
        <p className="text-2xl leading-snug font-medium">
          {speech.finalText}
          {speech.interim && <span className="text-zinc-400"> {speech.interim}</span>}
          {!speech.finalText && !speech.interim && (
            <span className="text-zinc-400">Listening…</span>
          )}
        </p>
      ) : (
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tap the mic or type here…"
          rows={2}
          lang={LANG_META[src].bcp47}
          spellCheck
          className="block w-full resize-none bg-transparent text-2xl leading-snug font-medium outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
        />
      )}
    </div>
  );

  const targetField =
    tgtText ? (
      <p className="text-2xl leading-snug font-semibold">{tgtText}</p>
    ) : translating ? (
      <div className="space-y-2">
        <div className="h-6 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-5 w-1/2 animate-pulse rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
      </div>
    ) : (
      <p className="text-xl leading-snug text-zinc-400">Translation will appear here…</p>
    );

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* ── Toolbar row: language bar + view switcher + voice control ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="relative">
          <LanguageBar
            src={src}
            tgt={tgt}
            onChangeSrc={setSrc}
            onChangeTgt={setTgt}
            onSwap={swapWithText}
          />
          <DevBadge n={6} label="lang" />
        </div>
        <div className="flex items-center gap-2">
          <ViewSwitcher view={view} setView={setView} />
          <VoiceControl
            voices={voices}
            voiceURI={voiceURI}
            onPickVoice={pickVoice}
            autoSpeak={autoSpeak}
            onToggleAutoSpeak={() => setAutoSpeak((v) => !v)}
            ttsSupported={ttsSupported}
            tgt={tgt}
          />
        </div>
      </div>

      {/* ── View-specific layout ───────────────────────────────────────────── */}
      {view === "split" && (
        <>
          {/* Source pane — content-sized, stays expanded when focus moves */}
          <div className="relative rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <FlagLabel lang={src} />
            <div className="mt-2">{sourceField}</div>
            {sourceText && (
              <button
                type="button"
                onClick={clearAll}
                aria-label="Clear"
                className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full text-zinc-400 hover:bg-black/5 dark:hover:bg-white/10"
              >
                ✕
              </button>
            )}
            <DevBadge n={1} label="src" />
          </div>

          {controlCluster}

          {/* Translation pane — content-sized */}
          <div className="relative rounded-2xl border border-zinc-300 bg-zinc-100/70 p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/40">
            <FlagLabel lang={tgt} loading={translating} />
            <div className="mt-2">{targetField}</div>
            {translation?.idiomatic?.note && (
              <p className="mt-3 text-xs italic text-zinc-500">{translation.idiomatic.note}</p>
            )}
            {translation?.notes && translation.fallback && (
              <p className="mt-3 text-[11px] text-zinc-400">{translation.notes}</p>
            )}
            {tgtText && (
              <p className="mt-2 text-[11px] text-zinc-400">{wordCount(tgtText)} words</p>
            )}
            <DevBadge n={5} label="tgt" />
          </div>
        </>
      )}

      {view === "paragraph" && (
        <ParagraphLayout
          src={src}
          tgt={tgt}
          text={text}
          setText={setText}
          sourceText={sourceText}
          tgtText={tgtText}
          interim={speech.listening ? speech.interim : ""}
          isListening={speech.listening}
          translating={translating}
          controls={controlCluster}
        />
      )}

      {view === "stream" && (
        <StreamLayout
          src={src}
          tgt={tgt}
          text={text}
          setText={setText}
          sourceText={sourceText}
          tgtText={tgtText}
          interim={speech.listening ? speech.interim : ""}
          isListening={speech.listening}
          translating={translating}
          controls={controlCluster}
        />
      )}

      {/* Executive summary card */}
      {(summary || summarizing) && (
        <div className="relative rounded-2xl border border-zinc-300 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          {/* Trek-style top corner trace */}
          <span aria-hidden className="pointer-events-none absolute left-0 top-0 h-3 w-8 rounded-tl-2xl border-l border-t border-zinc-900/40 dark:border-zinc-100/40" />
          <span aria-hidden className="pointer-events-none absolute right-0 bottom-0 h-3 w-8 rounded-br-2xl border-r border-b border-zinc-900/40 dark:border-zinc-100/40" />
          <div className="flex items-center justify-between gap-2">
            <h3 className="system-label text-zinc-900 dark:text-zinc-100">
              ▸ Executive summary
            </h3>
            {summary && (
              <span className="system-label text-zinc-500 dark:text-zinc-400">
                {summary.provider === "llm" ? "src · CLAUDE" : "src · HEURISTIC"}
              </span>
            )}
          </div>
          {summarizing ? (
            <div className="mt-3 space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-200/60 dark:bg-zinc-800/60" />
            </div>
          ) : (
            summary && (
              <>
                <p className="mt-2 text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200">
                  {summary.text}
                </p>
                {summary.note && (
                  <p className="mt-2 text-[11px] italic text-zinc-500 dark:text-zinc-400">
                    {summary.note}
                  </p>
                )}
                {ttsSupported && (
                  <button
                    type="button"
                    onClick={() => startSpeaking(summary.text)}
                    className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${BTN_CHIP}`}
                  >
                    <SpeakerIcon className="h-3 w-3" />
                    speak summary
                  </button>
                )}
              </>
            )
          )}
        </div>
      )}

      {/* Status row */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        <span>
          {asrSupported ? (
            speech.listening ? (
              <span className="inline-flex items-center gap-1.5 font-mono text-zinc-900 dark:text-zinc-100">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-900 dark:bg-zinc-100" />
                LIVE · {LANG_META[src].name.toUpperCase()} · tap STOP to end
                {translation?.primary && translation.primary !== "—" && (
                  <span className="font-mono text-zinc-500 dark:text-zinc-400">
                    {" "}· {wordCount(translation.primary)}/{SUMMARY_THRESHOLD_WORDS} → summary
                  </span>
                )}
              </span>
            ) : (
              <>Tap mic to talk · ASR uses your browser, no audio leaves the device.</>
            )
          ) : isIos() ? (
            "iOS: enable Siri & Dictation in Settings → General → Keyboard, then tap the mic."
          ) : (
            "Voice input not supported here — try Chrome, Edge, or Safari."
          )}
        </span>
        {speech.error && <span className="font-mono text-zinc-900 dark:text-zinc-100">ERR · {speech.error}</span>}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// View switcher — three-way segmented control: split / paragraph / stream.
// ──────────────────────────────────────────────────────────────────────────
function ViewSwitcher({ view, setView }: { view: View; setView: (v: View) => void }) {
  const items: Array<{ id: View; label: string; icon: React.ReactNode; title: string }> = [
    {
      id: "split",
      label: "split",
      title: "Top source pane, mic controls in the middle, bottom translation pane",
      icon: (
        <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" aria-hidden>
          <rect x="1.5" y="2" width="11" height="3.5" rx="0.6" stroke="currentColor" strokeWidth="1.1" />
          <rect x="1.5" y="8.5" width="11" height="3.5" rx="0.6" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      ),
    },
    {
      id: "paragraph",
      label: "pairs",
      title: "Stacked paragraph pairs (source paragraph, then translation paragraph)",
      icon: (
        <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" aria-hidden>
          <path d="M1.5 3h11M1.5 5h7M1.5 7H13M1.5 9h6M1.5 11h11" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: "stream",
      label: "stream",
      title: "Both panes scroll — only the latest input and translation lines stay in view",
      icon: (
        <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" aria-hidden>
          <path d="M1.5 4h11M1.5 6h11M1.5 10h11" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          <path d="M11 12l1.5-1.5L11 9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];
  return (
    <div className={`relative inline-flex rounded-full p-0.5 ${BTN_CHIP}`}>
      {items.map((it) => {
        const active = view === it.id;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => setView(it.id)}
            aria-pressed={active}
            title={it.title}
            className={`relative inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${
              active ? BTN_CHIP_ACTIVE : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {it.icon}
            <span className="hidden sm:inline">{it.label}</span>
          </button>
        );
      })}
      <DevBadge n={7} label="view" />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Paragraph layout — single column. Source paragraphs (sentence-grouped to
// ~25 words each) stacked above thin rules with the matching translated
// paragraph below. Auto-scrolls to bottom when content grows (sticks to
// bottom unless the user has scrolled up).
// ──────────────────────────────────────────────────────────────────────────
function ParagraphLayout({
  src,
  tgt,
  text,
  setText,
  sourceText,
  tgtText,
  interim,
  isListening,
  translating,
  controls,
}: {
  src: Lang;
  tgt: Lang;
  text: string;
  setText: (s: string) => void;
  sourceText: string;
  tgtText: string;
  interim: string;
  isListening: boolean;
  translating: boolean;
  controls: React.ReactNode;
}) {
  const srcPs = groupSentencesIntoParagraphs(splitSentences(sourceText));
  const tgtPs = groupSentencesIntoParagraphs(splitSentences(tgtText));
  const pairs = pairParagraphs(srcPs, tgtPs);
  const scrollRef = useStickyBottom<HTMLDivElement>(sourceText.length + tgtText.length + interim.length);
  const inputRef = useAutoGrowTextarea(text);

  return (
    <>
      {/* Mic cluster centered horizontally — only moves up/down with content, not left. */}
      <div className="relative flex items-center justify-center">{controls}</div>

      {/* Editable source — always visible, lets the user type in Pairs view too. */}
      <div className="relative rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <FlagLabel lang={src} />
        <div className="mt-2 min-h-[4.5rem]">
          {isListening ? (
            <p className="text-xl leading-snug font-medium">
              {sourceText}
              {interim && <span className="text-zinc-400"> {interim}</span>}
              {!sourceText && !interim && <span className="text-zinc-400">Listening…</span>}
            </p>
          ) : (
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Tap the mic or type here — pairs will appear below."
              rows={2}
              lang={LANG_META[src].bcp47}
              spellCheck
              className="block w-full resize-none bg-transparent text-xl leading-snug font-medium outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            />
          )}
        </div>
        <DevBadge n={1} label="src·pairs" />
      </div>

      {/* Rendered paragraph pairs — read-only view that mirrors the source above. */}
      <div
        ref={scrollRef}
        className="relative max-h-[55dvh] min-h-[20dvh] overflow-y-auto rounded-2xl border border-zinc-300 bg-zinc-100/70 p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/40"
      >
        <DevBadge n={5} label="pairs" />
        {pairs.length === 0 ? (
          <p className="text-zinc-400">Translation will appear here…</p>
        ) : (
          <ul className="space-y-6">
            {pairs.map((p, i) => (
              <li key={i} className="space-y-3">
                <p className="text-[17px] leading-relaxed font-medium text-zinc-900 dark:text-zinc-100">
                  <span className="mr-2 align-middle text-base leading-none">{LANG_META[src].flag}</span>
                  {p.src || <span className="text-zinc-400">…</span>}
                </p>
                <hr className="border-t border-zinc-300/70 dark:border-zinc-700/70" />
                <p className="text-[17px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                  <span className="mr-2 align-middle text-base leading-none">{LANG_META[tgt].flag}</span>
                  {p.tgt || (translating ? <span className="text-zinc-400">translating…</span> : <span className="text-zinc-400">…</span>)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Stream layout — split top/bottom panes; both auto-scroll so the latest
// source and translation lines stay in view (older content scrolls off the
// top). Simultaneous-interpretation captions.
// ──────────────────────────────────────────────────────────────────────────
/**
 * Stream layout — ONE container, top textarea + thin rule + bottom translation.
 * Each pane scrolls independently. Scrolling either side moves the other
 * proportionally so the matching segment stays in view.
 */
function StreamLayout({
  src,
  tgt,
  text,
  setText,
  sourceText,
  tgtText,
  interim,
  isListening,
  translating,
  controls,
}: {
  src: Lang;
  tgt: Lang;
  text: string;
  setText: (s: string) => void;
  sourceText: string;
  tgtText: string;
  interim: string;
  isListening: boolean;
  translating: boolean;
  controls: React.ReactNode;
}) {
  const srcRef = useRef<HTMLDivElement | null>(null);
  const tgtRef = useRef<HTMLDivElement | null>(null);
  const isSyncingRef = useRef(false);
  const inputRef = useAutoGrowTextarea(text);

  // Proportional scroll sync — scrolling one pane moves the other to the same
  // relative position so the matching translation segment stays in view.
  // Re-entry guard prevents the scroll handlers from echoing off each other.
  useEffect(() => {
    const srcEl = srcRef.current;
    const tgtEl = tgtRef.current;
    if (!srcEl || !tgtEl) return;

    const sync = (from: HTMLDivElement, to: HTMLDivElement) => {
      if (isSyncingRef.current) return;
      const maxFrom = from.scrollHeight - from.clientHeight;
      const maxTo = to.scrollHeight - to.clientHeight;
      if (maxFrom <= 0 || maxTo <= 0) return;
      isSyncingRef.current = true;
      to.scrollTop = (from.scrollTop / maxFrom) * maxTo;
      requestAnimationFrame(() => {
        isSyncingRef.current = false;
      });
    };

    const onSrc = () => sync(srcEl, tgtEl);
    const onTgt = () => sync(tgtEl, srcEl);
    srcEl.addEventListener("scroll", onSrc, { passive: true });
    tgtEl.addEventListener("scroll", onTgt, { passive: true });
    return () => {
      srcEl.removeEventListener("scroll", onSrc);
      tgtEl.removeEventListener("scroll", onTgt);
    };
  }, []);

  // Stick-to-bottom on new content (only when user hasn't scrolled away).
  useEffect(() => {
    const el = srcRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [sourceText, interim]);
  useEffect(() => {
    const el = tgtRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [tgtText]);

  return (
    <>
      {/* Mic cluster centered. */}
      <div className="relative flex items-center justify-center">{controls}</div>

      {/* Single container with two independently-scrolling halves + thin rule. */}
      <div
        className="relative flex flex-col overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
        style={{ height: "min(60dvh, 640px)" }}
      >
        {/* Top: source — editable when not listening, live transcript when listening. */}
        <div ref={srcRef} className="relative flex-1 overflow-y-auto px-4 py-3">
          <FlagLabel lang={src} />
          <div className="mt-1.5">
            {isListening ? (
              <p className="text-xl leading-snug font-medium">
                {sourceText}
                {interim && <span className="text-zinc-400"> {interim}</span>}
                {!sourceText && !interim && <span className="text-zinc-400">Listening…</span>}
              </p>
            ) : (
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Tap the mic or type here — translation streams below."
                rows={2}
                lang={LANG_META[src].bcp47}
                spellCheck
                className="block w-full resize-none bg-transparent text-xl leading-snug font-medium outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              />
            )}
          </div>
          <DevBadge n={1} label="src·stream" />
        </div>

        {/* Thin rule between source and translation halves. */}
        <hr className="border-t border-zinc-200 dark:border-zinc-800" aria-hidden />

        {/* Bottom: translation. */}
        <div ref={tgtRef} className="relative flex-1 overflow-y-auto px-4 py-3 bg-zinc-50/60 dark:bg-zinc-800/30">
          <FlagLabel lang={tgt} loading={translating} />
          <p className="mt-1.5 text-xl leading-snug font-semibold">
            {tgtText || <span className="text-zinc-400 font-normal">Translation will appear here…</span>}
          </p>
          <DevBadge n={5} label="tgt·stream" />
        </div>
      </div>
    </>
  );
}


function FlagLabel({ lang, loading }: { lang: Lang; loading?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
      <span className="text-base leading-none">{LANG_META[lang].flag}</span>
      <span>{LANG_META[lang].native}</span>
      {loading && (
        <span className="ml-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-900 dark:bg-zinc-100" />
      )}
    </div>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3z" stroke="currentColor" strokeWidth="2" />
      <path d="M19 12a7 7 0 01-14 0M12 19v3M8 22h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="2.5" />
    </svg>
  );
}

function SpeakerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9H4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M16 8a5 5 0 010 8M19 5a9 9 0 010 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16M9 7V4h6v3m-7 0v13a2 2 0 002 2h4a2 2 0 002-2V7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
