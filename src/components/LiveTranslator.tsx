"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LanguageBar from "@/components/LanguageBar";
import DevBadge from "@/components/DevBadge";
import VoiceControl from "@/components/VoiceControl";
import { saveSession, updateSession, type Session } from "@/lib/history";
import {
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

  // Pairs view — committed paragraph pairs (read-only history above the active pair).
  // Lifted here so the swap button can flip every pair, not just the active one.
  const [pairsCommitted, setPairsCommitted] = useState<Pair[]>([]);

  // ── Smart swap ───────────────────────────────────────────────────────────
  // Reverse button on the LanguageBar now also reverses the *text*: the current
  // translation becomes the new source, and the translation re-runs in the
  // opposite direction. In Pairs view, every committed pair flips too — what
  // was the source becomes the target in the new direction.
  const swapWithText = useCallback(() => {
    const tgtTextNow = translation?.primary && translation.primary !== "—" ? translation.primary : "";
    if (tgtTextNow) setText(tgtTextNow);
    setPairsCommitted((prev) => prev.map((p) => ({ id: p.id, src: p.tgt, tgt: p.src })));
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
    setPairsCommitted([]);
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
  // whitespace-pre-wrap preserves user-typed newlines (return key carries
  // through to layout) so the source text reads the way it was written.
  const sourceField = (
    <div className="min-h-[4.5rem]">
      {speech.listening ? (
        <p className="text-2xl leading-snug font-medium whitespace-pre-wrap">
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
      <p className="text-2xl leading-snug font-semibold whitespace-pre-wrap">{tgtText}</p>
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
      {/* Transcription mode: same source and target lang = single-pane
          dictation/file-transcribe UI, no translation. */}
      {src === tgt && (
        <TranscribeLayout
          src={src}
          text={text}
          setText={setText}
          interim={speech.listening ? speech.interim : ""}
          isListening={speech.listening}
          ttsSupported={ttsSupported}
          summary={summary}
          summarizing={summarizing}
          requestSummary={requestSummary}
          taRef={taRef}
          clearAll={clearAll}
          controls={controlCluster}
        />
      )}

      {src !== tgt && view === "split" && (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {/* Chat-paradigm: TARGET on top fills available vertical space;
              SOURCE at bottom grows upward as the user types (textarea
              auto-grow capped at 50dvh); MIC CLUSTER pinned at the bottom
              in the thumb zone. No empty real estate — when source is
              short the target gets nearly all the height, and vice versa.
              When both grow to meet in the middle they scroll internally. */}

          {/* Translation pane — flex-1 fills remaining space. */}
          <div className="relative flex-1 min-h-[8rem] overflow-y-auto rounded-2xl border border-zinc-300 bg-zinc-100/70 p-4 pb-12 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/40">
            <FlagLabel lang={tgt} loading={translating} />
            {pairsCommitted.length > 0 && (
              <div className="mt-2 space-y-3 border-b border-zinc-300/70 pb-3 dark:border-zinc-700/60">
                {pairsCommitted.map((p) => (
                  <p
                    key={p.id}
                    className="text-[17px] leading-relaxed whitespace-pre-wrap text-zinc-700 dark:text-zinc-300"
                  >
                    {p.tgt || <span className="text-zinc-400">…</span>}
                  </p>
                ))}
              </div>
            )}
            <div className={pairsCommitted.length > 0 ? "mt-3" : "mt-2"}>{targetField}</div>
            {translation?.idiomatic?.note && (
              <p className="mt-3 text-xs italic text-zinc-500">{translation.idiomatic.note}</p>
            )}
            {translation?.notes && translation.fallback && (
              <p className="mt-3 text-[11px] text-zinc-400">{translation.notes}</p>
            )}
            {tgtText && (
              <p className="mt-2 text-[11px] text-zinc-400">{wordCount(tgtText)} words</p>
            )}
            <FieldActions
              text={[...pairsCommitted.map((p) => p.tgt), tgtText].filter(Boolean).join("\n\n")}
              lang={tgt}
              ttsSupported={ttsSupported}
            />
            <DevBadge n={5} label="tgt" />
          </div>

          {/* Source pane — content-sized, anchored at the bottom. Grows
              upward as the user types; caps at 50dvh and scrolls. */}
          <div className="relative shrink-0 max-h-[50dvh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 pb-12 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <FlagLabel lang={src} />
            {pairsCommitted.length > 0 && (
              <div className="mt-2 space-y-3 border-b border-zinc-200 pb-3 dark:border-zinc-800">
                {pairsCommitted.map((p) => (
                  <p
                    key={p.id}
                    className="text-[17px] leading-relaxed whitespace-pre-wrap text-zinc-700 dark:text-zinc-300"
                  >
                    {p.src}
                  </p>
                ))}
              </div>
            )}
            <div className={pairsCommitted.length > 0 ? "mt-3" : "mt-2"}>{sourceField}</div>
            {(sourceText || pairsCommitted.length > 0) && (
              <button
                type="button"
                onClick={clearAll}
                aria-label="Clear"
                className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full text-zinc-400 hover:bg-black/5 dark:hover:bg-white/10"
              >
                ✕
              </button>
            )}
            <FieldActions
              text={[...pairsCommitted.map((p) => p.src), sourceText].filter(Boolean).join("\n\n")}
              lang={src}
              ttsSupported={ttsSupported}
            />
            <DevBadge n={1} label="src" />
          </div>

          {/* Mic cluster — thumb-zone, very bottom of the live view. */}
          {controlCluster}
        </div>
      )}

      {src !== tgt && view === "paragraph" && (
        <ParagraphLayout
          src={src}
          tgt={tgt}
          text={text}
          setText={setText}
          tgtText={tgtText}
          interim={speech.listening ? speech.interim : ""}
          isListening={speech.listening}
          translating={translating}
          committed={pairsCommitted}
          setCommitted={setPairsCommitted}
          controls={controlCluster}
        />
      )}

      {src !== tgt && view === "stream" && (
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
          committed={pairsCommitted}
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
// Pairs view — scrolling teleprompter. One continuous column of paragraph
// pairs. Committed pairs are read-only above; the bottom (active) pair has
// the editable source on top of its live translation. As the active source
// crosses a commit threshold, the pair freezes into the read-only stack and
// the editor resets to an empty new active pair. See DESIGN §13.1.
// ──────────────────────────────────────────────────────────────────────────

export type Pair = { id: string; src: string; tgt: string };

/** Word-count helper local to this layout. */
function wc(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function ParagraphLayout({
  src,
  tgt,
  text,
  setText,
  tgtText,
  interim,
  isListening,
  translating,
  committed,
  setCommitted,
  controls,
}: {
  src: Lang;
  tgt: Lang;
  text: string;
  setText: (s: string) => void;
  tgtText: string;
  interim: string;
  isListening: boolean;
  translating: boolean;
  committed: Pair[];
  setCommitted: React.Dispatch<React.SetStateAction<Pair[]>>;
  controls: React.ReactNode;
}) {
  const scrollRef = useStickyBottom<HTMLDivElement>(
    committed.length + text.length + tgtText.length + interim.length,
  );
  const inputRef = useAutoGrowTextarea(text);

  // Track the active source: when speech is on, it's text + interim; otherwise text.
  const activeSrc = isListening ? (text + (interim ? (text ? " " : "") + interim : "")) : text;
  const lastEnterRef = useRef(0);

  // commit() is the only path that moves the active pair into the committed list.
  // We capture text + tgtText at the moment of commit, push them as a frozen
  // Pair, then reset the active source so the textarea is empty again.
  const commit = useCallback(() => {
    const s = text.trim();
    if (!s) return;
    const t = (tgtText || "").trim();
    setCommitted((prev) => {
      const next: Pair[] = [
        ...prev,
        { id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, src: s, tgt: t },
      ];
      // FIFO cap so the DOM doesn't grow forever during multi-hour sessions.
      return next.length > 200 ? next.slice(next.length - 200) : next;
    });
    setText("");
  }, [text, tgtText, setText, setCommitted]);

  const lastTypedRef = useRef(Date.now());

  // ── Commit triggers ─────────────────────────────────────────────────────
  // (a) Sentence-end punctuation + ≥ 20 words, OR
  // (b) ≥ 60 words even without terminal punctuation (run-on guard), OR
  // (c) ≥ 3 s of mic silence with ≥ 5 words (speech pause), OR
  // (d) Double-Enter — see onKeyDown below.
  // Runs whenever the source text changes.
  useEffect(() => {
    lastTypedRef.current = Date.now();
    const words = wc(text);
    if (words >= 60) {
      commit();
      return;
    }
    if (words >= 20 && /[.!?]\s*$/.test(text.trim())) {
      commit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // Speech-pause auto-commit (re-enabled per user feedback v0.11.2).
  useEffect(() => {
    if (!isListening) return;
    const id = setTimeout(() => {
      if (wc(text) >= 5 && Date.now() - lastTypedRef.current >= 3000) {
        commit();
      }
    }, 3100);
    return () => clearTimeout(id);
  }, [text, interim, isListening, commit]);

  // Double-Enter — explicit hard break. Handled in onKeyDown so we can
  // preventDefault and avoid leaving stray newlines in the source field.
  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      const now = Date.now();
      if (now - lastEnterRef.current < 700 && text.trim()) {
        e.preventDefault();
        commit();
        lastEnterRef.current = 0;
        return;
      }
      lastEnterRef.current = now;
    }
  };

  return (
    <>
      {/* Single continuous container: committed pairs above, active pair (editable) at the bottom. */}
      <div
        ref={scrollRef}
        onClick={(e) => {
          // Click anywhere in the empty space focuses the input — feels like a text field.
          const tag = (e.target as HTMLElement).tagName;
          if (tag === "DIV" || tag === "LI") {
            // Defer focus so the textarea exists by the time we look it up.
            requestAnimationFrame(() => {
              const ta = (e.currentTarget as HTMLDivElement).querySelector<HTMLTextAreaElement>("textarea");
              ta?.focus();
            });
          }
        }}
        className="relative max-h-[68dvh] min-h-[30dvh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <DevBadge n={1} label="pairs" />

        <ul className="space-y-6">
          {committed.map((p) => (
            <li key={p.id} className="space-y-2">
              <p className="text-[17px] leading-relaxed font-medium text-zinc-900 whitespace-pre-wrap dark:text-zinc-100">
                <span className="mr-2 align-middle text-base leading-none">{LANG_META[src].flag}</span>
                {p.src}
              </p>
              <hr className="border-t border-zinc-300/80 dark:border-zinc-700/70" />
              <p className="text-[17px] leading-relaxed text-zinc-700 whitespace-pre-wrap dark:text-zinc-300">
                <span className="mr-2 align-middle text-base leading-none">{LANG_META[tgt].flag}</span>
                {p.tgt || <span className="text-zinc-400">…</span>}
              </p>
            </li>
          ))}

          {/* Active pair — editable source on top, live translation below. */}
          <li className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="mt-1 align-middle text-base leading-none">{LANG_META[src].flag}</span>
              <div className="flex-1">
                {isListening ? (
                  <p className="text-[17px] leading-relaxed font-medium whitespace-pre-wrap text-zinc-900 dark:text-zinc-100">
                    {text}
                    {interim && <span className="text-zinc-400"> {interim}</span>}
                    {!text && !interim && <span className="text-zinc-400">Listening…</span>}
                  </p>
                ) : (
                  <textarea
                    ref={inputRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type or talk. Press Enter twice to break a paragraph."
                    rows={1}
                    lang={LANG_META[src].bcp47}
                    spellCheck
                    className="block w-full resize-none bg-transparent text-[17px] leading-relaxed font-medium whitespace-pre-wrap outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                  />
                )}
              </div>
            </div>
            <hr className="border-t border-dashed border-zinc-300 dark:border-zinc-700" />
            <p className="text-[17px] leading-relaxed text-zinc-700 whitespace-pre-wrap dark:text-zinc-300">
              <span className="mr-2 align-middle text-base leading-none">{LANG_META[tgt].flag}</span>
              {tgtText ? (
                tgtText
              ) : translating ? (
                <span className="text-zinc-400">translating…</span>
              ) : (
                <span className="text-zinc-400">Translation will appear here…</span>
              )}
            </p>
          </li>
        </ul>

        {committed.length === 0 && !activeSrc && (
          <p className="mt-2 text-center text-[11px] text-zinc-400">
            Each paragraph commits on `.?!` + 20 words, on a double-Enter, or after a 3 s speech pause.
          </p>
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
  committed,
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
  committed: Pair[];
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
        {/* Top: source — committed paragraphs (read-only), then editable
            active textarea (or live transcript when listening). */}
        <div ref={srcRef} className="relative flex-1 overflow-y-auto px-4 py-3">
          <FlagLabel lang={src} />
          {committed.length > 0 && (
            <div className="mt-2 space-y-3 border-b border-zinc-200 pb-3 dark:border-zinc-800">
              {committed.map((p) => (
                <p key={p.id} className="text-xl leading-snug whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                  {p.src}
                </p>
              ))}
            </div>
          )}
          <div className={committed.length > 0 ? "mt-3" : "mt-1.5"}>
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

        {/* Bottom: translation — committed paragraphs above, active below. */}
        <div ref={tgtRef} className="relative flex-1 overflow-y-auto px-4 py-3 bg-zinc-50/60 dark:bg-zinc-800/30">
          <FlagLabel lang={tgt} loading={translating} />
          {committed.length > 0 && (
            <div className="mt-2 space-y-3 border-b border-zinc-300/70 pb-3 dark:border-zinc-700/60">
              {committed.map((p) => (
                <p key={p.id} className="text-xl leading-snug whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                  {p.tgt || <span className="text-zinc-400">…</span>}
                </p>
              ))}
            </div>
          )}
          <p className={`text-xl leading-snug font-semibold ${committed.length > 0 ? "mt-3" : "mt-1.5"}`}>
            {tgtText || <span className="text-zinc-400 font-normal">Translation will appear here…</span>}
          </p>
          <DevBadge n={5} label="tgt·stream" />
        </div>
      </div>
    </>
  );
}


/**
 * Per-field action row — copy + speak. Sits in the bottom-right of each
 * text field so the field's content can be exported with one tap. Distinct
 * from the toolbar speaker which controls *continuous* auto-speak.
 */
// ──────────────────────────────────────────────────────────────────────────
// Transcription layout — triggered when source language === target language.
// Single pane, no translation. Pure dictation / file-transcribe UI with a
// manual Summarise button. DESIGN §15.
// ──────────────────────────────────────────────────────────────────────────
function TranscribeLayout({
  src,
  text,
  setText,
  interim,
  isListening,
  ttsSupported,
  summary,
  summarizing,
  requestSummary,
  taRef,
  clearAll,
  controls,
}: {
  src: Lang;
  text: string;
  setText: (s: string) => void;
  interim: string;
  isListening: boolean;
  ttsSupported: boolean;
  summary: { text: string; provider: string; note?: string } | null;
  summarizing: boolean;
  requestSummary: (text: string) => void;
  taRef: (el: HTMLTextAreaElement | null) => void;
  clearAll: () => void;
  controls: React.ReactNode;
}) {
  const live = isListening ? text + (interim ? (text ? " " : "") + interim : "") : text;
  const canSummarise = live.trim().length > 0 && !summarizing;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Transcript pane fills the screen — same chat-paradigm: one big
          read/write region above the mic cluster. */}
      <div className="relative flex-1 min-h-[12rem] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 pb-12 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <FlagLabel lang={src} />
          <span className="system-label text-zinc-500 dark:text-zinc-400">▸ TRANSCRIBE</span>
        </div>
        <div className="mt-2 min-h-[4.5rem]">
          {isListening ? (
            <p className="text-xl leading-relaxed font-medium whitespace-pre-wrap">
              {text}
              {interim && <span className="text-zinc-400"> {interim}</span>}
              {!text && !interim && <span className="text-zinc-400">Listening…</span>}
            </p>
          ) : (
            <textarea
              ref={taRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Tap the mic to dictate, or paste/drop text here…"
              rows={3}
              lang={LANG_META[src].bcp47}
              spellCheck
              className="block w-full resize-none bg-transparent text-xl leading-relaxed font-medium outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            />
          )}
        </div>
        {text && (
          <button
            type="button"
            onClick={clearAll}
            aria-label="Clear"
            className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full text-zinc-400 hover:bg-black/5 dark:hover:bg-white/10"
          >
            ✕
          </button>
        )}
        <FieldActions text={live} lang={src} ttsSupported={ttsSupported} />
        <DevBadge n={1} label="transcript" />
      </div>

      {/* Summary card — appears under the transcript when present. */}
      {(summary || summarizing) && (
        <div className="relative rounded-2xl border border-zinc-300 bg-zinc-50 p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/60">
          <div className="flex items-center justify-between">
            <h3 className="system-label text-zinc-700 dark:text-zinc-200">▸ Summary</h3>
            {summary && (
              <span className="system-label text-zinc-500 dark:text-zinc-400">
                src · {summary.provider === "llm" ? "CLAUDE" : "HEURISTIC"}
              </span>
            )}
          </div>
          {summarizing ? (
            <div className="mt-3 space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-200/70 dark:bg-zinc-800/70" />
            </div>
          ) : (
            summary && (
              <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
                {summary.text}
              </p>
            )
          )}
        </div>
      )}

      {/* Mic cluster + Summarise side-button. */}
      <div className="relative flex items-center justify-center gap-3">
        {controls}
        <button
          type="button"
          onClick={() => canSummarise && requestSummary(live)}
          disabled={!canSummarise}
          aria-label="Summarise transcript"
          title="Summarise the transcript so far"
          className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${BTN_CHIP}`}
        >
          <span className="font-mono uppercase tracking-[0.14em]">Σ</span>
          <span className="hidden sm:inline">summarise</span>
          <DevBadge n="S" label="summary" position="tr" />
        </button>
      </div>
    </div>
  );
}

function FieldActions({
  text,
  lang,
  ttsSupported,
}: {
  text: string;
  lang: Lang;
  ttsSupported: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const onCopy = () => {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };
  const onSpeak = () => {
    if (!text || !ttsSupported) return;
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    speak(text, LANG_META[lang].tts, {
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  if (!text) return null;
  return (
    <div className="absolute bottom-2 right-2 flex items-center gap-0.5 opacity-60 transition-opacity hover:opacity-100">
      <button
        type="button"
        onClick={onSpeak}
        disabled={!ttsSupported}
        aria-label={speaking ? "Stop speaking" : `Speak in ${LANG_META[lang].name}`}
        title={speaking ? "Stop speaking" : `Speak (${LANG_META[lang].name})`}
        className={`grid h-7 w-7 place-items-center rounded ${BTN_CHIP}`}
      >
        {speaking ? (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
            <path d="M4 9v6h4l5 4V5L8 9H4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M16 8a5 5 0 010 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={onCopy}
        aria-label={copied ? "Copied" : "Copy text"}
        title={copied ? "Copied!" : "Copy"}
        className={`grid h-7 w-7 place-items-center rounded ${BTN_CHIP}`}
      >
        {copied ? (
          <span className="text-[10px] font-mono">✓</span>
        ) : (
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
            <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M3 11V4.5A1.5 1.5 0 0 1 4.5 3H10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        )}
      </button>
    </div>
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
