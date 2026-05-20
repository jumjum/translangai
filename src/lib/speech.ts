// Browser SpeechRecognition + speechSynthesis wrappers.
//
// Robustness features (added v0.4 to fix the "echo repeat" bug):
//
//   1) Pause-during-TTS — `pause()` temporarily stops recognition without
//      losing the user's "wanted listening" intent, so when the device's
//      speaker plays a translation, the mic doesn't hear it and re-feed it
//      back into the transcript. `resume()` restarts cleanly.
//
//   2) iOS restart-delay — Safari ends recognition after every natural
//      pause. We restart on `onend`, but wait ~150 ms first to let the
//      engine fully tear down. Without this, restart storms can produce
//      duplicate final results.
//
//   3) Final-segment dedup — if a new final chunk equals the tail of the
//      cumulative transcript (case-insensitive), drop it. This protects
//      against engines that occasionally fire `onresult(isFinal)` twice
//      for the same phrase during a session restart.
//
//   4) Silenced error noise — "no-speech" and "aborted" are normal during
//      natural pauses; we don't surface them as user-visible errors.

import { useCallback, useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
type SR = any;

function getSpeechRecognitionCtor(): SR | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported() {
  return getSpeechRecognitionCtor() !== null;
}

export function isTtsSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** True for iOS Safari / iPadOS Safari — useful for guidance copy. */
export function isIos() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" &&
      (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints! > 1)
  );
}

export type SpeechState = {
  /** Reflects user intent — stays true through internal pauses for TTS. */
  listening: boolean;
  finalText: string;
  interim: string;
  liveText: string;
  error?: string;
  supported: boolean;
};

export function useSpeechRecognition(lang: string) {
  const [state, setState] = useState<SpeechState>({
    listening: false,
    finalText: "",
    interim: "",
    liveText: "",
    supported: isSpeechRecognitionSupported(),
  });

  // Persistent refs across the recognition session lifetime.
  const recogRef = useRef<any>(null);
  const finalRef = useRef("");
  const intentRef = useRef(false);   // user wants to be listening
  const pausedRef = useRef(false);   // internally paused (e.g., TTS playing)
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const langRef = useRef(lang);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  const clearRestartTimer = () => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  };

  const startInternal = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setState((s) => ({ ...s, error: "Speech recognition not supported.", supported: false }));
      return;
    }
    // Tear down any previous instance.
    try {
      recogRef.current?.stop?.();
    } catch {}

    const r = new Ctor();
    r.lang = langRef.current;
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onstart = () => setState((s) => ({ ...s, error: undefined }));

    r.onerror = (e: any) => {
      const code = e?.error ? String(e.error) : "speech-error";
      // Natural pauses on iOS surface as no-speech / aborted — ignore.
      if (code === "no-speech" || code === "aborted") return;
      setState((s) => ({ ...s, error: code }));
    };

    r.onend = () => {
      // We were asked to pause — don't restart, keep listening state visible.
      if (pausedRef.current) return;
      // User still wants to listen → reschedule a fresh session.
      if (intentRef.current) {
        clearRestartTimer();
        restartTimerRef.current = setTimeout(() => {
          if (intentRef.current && !pausedRef.current) startInternal();
        }, 150);
        return;
      }
      setState((s) => ({ ...s, listening: false }));
    };

    r.onresult = (e: any) => {
      let interim = "";
      let appended = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const txt = (res[0]?.transcript ?? "").trim();
        if (res.isFinal) appended += (appended ? " " : "") + txt;
        else interim += (interim ? " " : "") + txt;
      }
      if (appended) {
        // Dedup: drop the appended chunk if it just repeats the tail of finalRef.
        const tail = finalRef.current
          .slice(Math.max(0, finalRef.current.length - appended.length - 2))
          .toLowerCase()
          .trim();
        if (tail !== appended.toLowerCase().trim()) {
          finalRef.current = (finalRef.current + " " + appended).trim();
        }
      }
      const finalText = finalRef.current;
      const liveText = (finalText + " " + interim).trim();
      setState((s) => ({ ...s, finalText, interim, liveText }));
    };

    recogRef.current = r;
    try {
      r.start();
      setState((s) => ({ ...s, listening: true, error: undefined }));
    } catch (err) {
      // Engine still tearing down a previous session — retry once.
      setTimeout(() => {
        try {
          r.start();
          setState((s) => ({ ...s, listening: true, error: undefined }));
        } catch (e2) {
          setState((s) => ({ ...s, error: (e2 as Error).message }));
          intentRef.current = false;
        }
      }, 200);
    }
  }, []);

  const start = useCallback(() => {
    intentRef.current = true;
    pausedRef.current = false;
    startInternal();
  }, [startInternal]);

  const stop = useCallback(() => {
    intentRef.current = false;
    pausedRef.current = false;
    clearRestartTimer();
    try {
      recogRef.current?.stop?.();
    } catch {}
    setState((s) => ({ ...s, listening: false }));
  }, []);

  /** Briefly suspend recognition (e.g. while TTS plays) without changing intent. */
  const pause = useCallback(() => {
    if (!intentRef.current) return;
    pausedRef.current = true;
    clearRestartTimer();
    try {
      recogRef.current?.stop?.();
    } catch {}
    // Note: we keep state.listening = true so the UI doesn't flicker.
  }, []);

  /** Resume after a pause. No-op if intent is off. */
  const resume = useCallback(() => {
    if (!intentRef.current) return;
    pausedRef.current = false;
    // The previous onend may have fired without restarting because pausedRef
    // was true; start a fresh session now.
    setTimeout(() => {
      if (intentRef.current && !pausedRef.current) startInternal();
    }, 80);
  }, [startInternal]);

  const reset = useCallback(() => {
    finalRef.current = "";
    setState((s) => ({ ...s, finalText: "", interim: "", liveText: "" }));
  }, []);

  const toggle = useCallback(() => {
    if (intentRef.current) stop();
    else start();
  }, [start, stop]);

  useEffect(
    () => () => {
      intentRef.current = false;
      pausedRef.current = false;
      clearRestartTimer();
      try {
        recogRef.current?.stop?.();
      } catch {}
    },
    [],
  );

  return { ...state, start, stop, toggle, pause, resume, reset };
}

/** Resolve the voice list — handles Safari's async-on-first-call quirk. */
export function getVoicesAsync(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!isTtsSupported()) return resolve([]);
    const synth = window.speechSynthesis;
    const v = synth.getVoices();
    if (v.length) return resolve(v);

    let done = false;
    const finish = (list: SpeechSynthesisVoice[]) => {
      if (done) return;
      done = true;
      synth.removeEventListener("voiceschanged", onChange);
      resolve(list);
    };
    const onChange = () => finish(synth.getVoices());
    synth.addEventListener("voiceschanged", onChange);
    setTimeout(() => finish(synth.getVoices()), timeoutMs);
  });
}

/** Voices the device exposes for a given BCP-47 lang (e.g. "sv-SE" or "sv"). */
export async function listVoicesForLang(bcp47: string): Promise<SpeechSynthesisVoice[]> {
  const all = await getVoicesAsync();
  const base = bcp47.split("-")[0].toLowerCase();
  return all.filter(
    (v) =>
      v.lang.toLowerCase() === bcp47.toLowerCase() ||
      v.lang.toLowerCase().startsWith(base + "-") ||
      v.lang.toLowerCase() === base,
  );
}

export type SpeakOpts = {
  voiceURI?: string;
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
};

/** Speak `text` in the given BCP-47 lang. Returns a `cancel` function. */
export function speak(text: string, lang: string, opts: SpeakOpts = {}): () => void {
  if (!isTtsSupported() || !text.trim()) return () => {};
  const synth = window.speechSynthesis;
  synth.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = opts.rate ?? 1;
  utter.pitch = opts.pitch ?? 1;
  if (opts.onStart) utter.onstart = opts.onStart;
  if (opts.onEnd) utter.onend = opts.onEnd;
  if (opts.onError) utter.onerror = opts.onError;

  getVoicesAsync().then((voices) => {
    if (!voices.length) return;
    let match: SpeechSynthesisVoice | undefined;
    if (opts.voiceURI) {
      match = voices.find((v) => v.voiceURI === opts.voiceURI);
    }
    if (!match) {
      match =
        voices.find((v) => v.lang === lang) ??
        voices.find((v) => v.lang.startsWith(lang.split("-")[0]));
    }
    if (match) {
      if (synth.speaking) {
        synth.cancel();
        utter.voice = match;
        synth.speak(utter);
      } else {
        utter.voice = match;
      }
    }
  });

  synth.speak(utter);
  return () => synth.cancel();
}

/** Stop any in-flight speech. Safe to call when nothing is playing. */
export function stopSpeaking(): void {
  if (isTtsSupported()) window.speechSynthesis.cancel();
}
