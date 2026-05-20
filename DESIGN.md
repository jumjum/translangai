# TransLang AI — Design Specification (v0.4)

> Any-to-any dictionary & **omni-translator** for daily use. Multiple sources side-by-side. Web first, mobile-first UI, voice in/out, native macOS later.

---

## 1. Product Goals

1. **Faster + smarter than Google Translate / TranSync** for everyday lookups.
2. **Any-to-any** between **English, Russian, Danish, German, Swedish** from day one (20 directed pairs).
3. **Words, phrases, idioms, figures of speech** — idioms map to *local equivalents*, not literal translations.
4. **Multi-source parallel view** — see what 4 different engines say at once.
5. **Voice in + voice out** — speak in any supported language, see live transcription, hear the translation spoken back.
6. **Free by default, paid only on opt-in** — three free providers always wired (Local seed dict, MyMemory, LibreTranslate). DeepL & LLM panels exist but are gated by "Free mode" so a friend's deploy never accidentally bills them.
7. **Path to native macOS** — global hotkey + right-click "Translate selection" anywhere.

---

## 2. Non-Goals (for MVP)

- Document translation, OCR — later.
- Accounts / cloud sync — local storage only for v0.x.
- Languages outside EN / RU / DA / DE / SV.

---

## 3. UX Principles

| Principle | What it means here |
|---|---|
| **Talk, see, hear** | Live mode is one tap on a giant mic; you see your words appear in the source language and the translation grows under them in real time. 🔊 reads it aloud. |
| **One input, many answers** | Compare mode: single search box, four result panes update simultaneously. |
| **Language pick is two taps max** | Chip-based source/target picker, swap button, last-used pinned. |
| **Mobile-first** | Live mode is a vertical phone-shaped flow; Compare mode stacks 1 → 2×2 → 4. |
| **Quiet UI, loud content** | Neutral chrome; the translations are the hero. |
| **Free unless you say otherwise** | "Free mode" chip is green by default. Flipping it on lights up paid providers; the server *also* enforces this so a buggy client can't cost money. |

---

## 4. Information Architecture

```
┌─────────────────────────────────────────────┐
│  ▣ Polyglot  · omni-translator  [free] Live │  ← Header w/ mode + free toggle
├─────────────────────────────────────────────┤
│  [EN ▾]  ⇄  [SV ▾]   🔊 auto-speak           │  ← Language bar
├─────────────────────────────────────────────┤
│  🇬🇧 English                              ✕  │
│  hello, how are you?                         │  ← Live transcription (interim greyed)
├─────────────────────────────────────────────┤
│           🔊            ●            🗑      │  ← TTS, mic (pulses red), clear
│                  ╭───────╮                   │
│                  │  MIC  │                   │
│                  ╰───────╯                   │
├─────────────────────────────────────────────┤
│  🇸🇪 Svenska                                 │
│  hej, hur mår du?                            │  ← Live translation
└─────────────────────────────────────────────┘
```

Compare mode keeps the v0.1 layout (4 stackable result panels with per-slot provider picker).

---

## 5. Core Flows

### 5.1 Live (voice-first) — *default mode*
1. User taps the mic. Browser requests microphone permission once.
2. `SpeechRecognition` streams interim chunks in the source language → the source pane updates **in real time** (finalized text solid, interim greyed).
3. Each new chunk debounces by 220 ms → server is called for translation.
4. Translation appears in the target pane as it grows.
5. When the user pauses (no interim text), if **auto-speak** is on, `speechSynthesis` reads the final translation aloud in the target voice.
6. Manual 🔊 button always available.

### 5.2 Compare (typed lookup)
- Single input, 4 parallel provider panels.
- Each panel has a header dropdown to swap to a different provider.
- Layout configuration persists in `localStorage`.

### 5.3 Language Selection
- Top bar shows source + target as chips. Tap → popover with the 5 languages.
- ⇄ swap button.

### 5.4 Idiom Handling
- LLM provider receives a structured prompt asking for the idiomatic equivalent + literal gloss + cultural note.
- Returns JSON; the panel renders an "idiom" badge.

### 5.5 Cost-control
- Server-side LRU cache (500 entries, 24 h TTL) — every repeated phrase costs zero after first lookup, even across users on the same instance.
- "Free mode" toggle (default ON) blocks paid providers at the API gateway, not just in the client.
- Live mode's translation chain is **free-first**: `mymemory → libre → local` (or `llm → mymemory → libre → local` when paid is enabled).

---

## 6. Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Next.js App (PWA, mobile-first)                         │
│  ┌────────────┐   ┌──────────────────────────────────┐   │
│  │  UI        │──▶│  /api/translate  (orchestrator)  │   │
│  │  • Live    │   │   ├─ Free-mode gate              │   │
│  │  • Compare │   │   ├─ LRU cache (process-wide)    │   │
│  └────────────┘   │   └─▶ Provider plugin            │   │
│        ▲          └──────────────────────────────────┘   │
│        │                          │                       │
│  ┌────────────┐                   ▼                       │
│  │ Web Speech │   ┌──────────────────────────────────┐   │
│  │ API (ASR + │   │  Provider Plugins                │   │
│  │ TTS)       │   │   FREE:                          │   │
│  └────────────┘   │   • LocalDict (seed JSON)        │   │
│                   │   • MyMemory  (~1k words/day)    │   │
│  ┌────────────┐   │   • LibreTranslate (self-host)   │   │
│  │ localStore │   │   PAID (need key):               │   │
│  │ (config,   │   │   • DeepL                        │   │
│  │  free-mode)│   │   • LLM (Anthropic, idiom-aware) │   │
│  └────────────┘   │   • Thesaurus (LLM-backed)       │   │
│                   └──────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
                              │
                              ▼ (Phase 3)
            ┌──────────────────────────────────┐
            │  Tauri shell → native macOS      │
            │   • Global hotkey ⌘⇧D            │
            │   • Services menu integration    │
            │   • /usr/share/dict + DictKit    │
            └──────────────────────────────────┘
```

### Provider interface
```ts
interface TranslationProvider {
  info: { id, name, description, accent };
  supports(src, tgt): boolean;
  translate(req: { q, src, tgt }): Promise<TranslateResult>;
}
```

---

## 6½. Voice pipeline & anti-echo (v0.4)

A continuous voice translator running through the phone's *own speakers* hits a classic feedback loop: TTS plays the translation → microphone picks it up → transcribes it → translates *that* → speaks again. Four mechanisms keep the loop closed:

| # | Mechanism | Where |
|---|---|---|
| 1 | **Pause-during-TTS** — recognition is internally suspended while `speechSynthesis.speaking` is true, then resumed when speech ends. The UI's "listening" state stays visible so the user doesn't see flicker. | `useSpeechRecognition` → `pause()` / `resume()`; `LiveTranslator` `useEffect([isSpeaking])` |
| 2 | **iOS restart-delay** — Safari ends recognition after every natural pause; we restart on `onend` but wait ~150 ms first so the engine fully tears down. Without this, rapid restarts caused duplicate `onresult(isFinal)` events. | `speech.ts` `restartTimerRef` |
| 3 | **Final-segment dedup** — if a newly-finalized chunk equals the tail of the cumulative transcript (case-insensitive), drop it. Defends against engines that occasionally re-fire a final for the same phrase across a session restart. | `speech.ts` `r.onresult` |
| 4 | **Smarter auto-speak** — `autoSpeak` only fires when (a) user is in a real pause (no interim text), (b) the new translation is not a strict-prefix extension of what was just spoken, and (c) ≥1.2 s elapsed since the last utterance. | `LiveTranslator` `doTranslate` |

UI affordance for the user: the auto-speak toggle's tooltip notes "use headphones to avoid feedback." With headphones (or AirPods), all four mechanisms still apply and the system is silent regardless.

## 7. Mobile Compatibility Matrix

| Capability | Chrome (Android) | Safari (iOS 14.5+) | Chrome/Edge desktop | Notes |
|---|---|---|---|---|
| **Layout / safe-area** | ✅ | ✅ (notch handled) | ✅ | `viewport-fit=cover`, `min-h-dvh`, `safe-area-inset-*`. |
| **PWA install** | ✅ A2HS | ✅ A2HS via Share sheet | ✅ install icon | Web manifest + `apple-icon.tsx` shipped. |
| **SpeechRecognition (ASR)** | ✅ native | ✅ (Siri Dictation must be enabled) | ✅ | iOS auto-ends after pause → we restart on `onend` while user intent is "listening". |
| **speechSynthesis (TTS)** | ✅ | ✅ (voices load async) | ✅ | We wait on the `voiceschanged` event before picking a voice. |
| **Microphone permission** | https only | https only | https only | Vercel preview/production URLs are https. |
| **Dark mode** | ✅ system | ✅ system | ✅ system | `prefers-color-scheme` in CSS. |
| **Localized recognition** | en-US / ru-RU / da-DK / de-DE / sv-SE | same | same | Languages stored as BCP-47 in `LANG_META`. |

**iOS Safari testing tips:**
- Open https URL on the device → tap mic → grant mic permission once.
- If mic doesn't work: *Settings → General → Keyboard → Enable Dictation* must be on.
- *Settings → Safari → Advanced → Experimental Features* — keep Speech Recognition enabled (on by default in modern iOS).
- To install as PWA: tap the Share icon → "Add to Home Screen". You'll get the gradient "P" icon and a standalone app window.

**Known limitations:**
- iOS Safari truncates a single recognition session to about ~1 minute; we restart cleanly so the user never notices.
- Firefox Android does not implement `SpeechRecognition` — Live mode falls back to manual text input.

---

## 8. Tech Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 (App Router)** | RSC + API routes + easy PWA + free Vercel deploy |
| Lang | **TypeScript (strict)** | Provider contracts must be typed |
| UI | **Tailwind v4** | Mobile-first, dark mode, tiny bundle |
| Voice | **Web Speech API** (ASR + TTS) | No server, no key, on-device |
| Cache | **In-process LRU** | Survives across requests in one Vercel function instance |
| Tests | **Vitest** + jsdom | Fast, ESM-native, no ts-jest dance |
| Native (P3) | **Tauri 2** | Tiny binary, Rust hooks for global shortcut & macOS Services |
| Hosting | **Vercel free tier** | Auto https (required for mic), preview deploys per PR |

---

## 9. Tests

Run with `npm test`. Suite (25 tests, 4 files):

- `seed.test.ts` (7) — seed dictionary covers all 5 langs, case-insensitive, idiom flags set, misses return null, example sentences hydrate.
- `cache.test.ts` (4) — LRU eviction, TTL expiry, clear.
- `providers.test.ts` (10) — registry shape, free-first defaults, partition, local lookups, MyMemory + LibreTranslate parsing + fallback, paid providers fail safe without keys (fetch mocked).
- `speech.test.ts` (3) — `isSpeechRecognitionSupported`/`isTtsSupported` env guards, with simulated `webkitSpeechRecognition` (jsdom env).

CI command (add to GitHub Actions later):
```yaml
- run: npm ci
- run: npm run typecheck
- run: npm test
- run: npm run build
```

---

## 10. Local-dictionary architecture (tiered)

The local provider is designed as **four tiers**, only Tier 1 + Tier 2 implemented today; Tiers 3-4 plug into the same `seedLookupPhrase` seam without touching anything above it.

```
                  seedLookupPhrase(src, tgt, q)
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
   1) Exact phrase match            (none) → 2) Tokenize
   (idioms, curated phrases)                  │
                                              ▼
                                ┌─────────────┴─────────────┐
                                │   For each non-punct tok  │
                                │   look up in INDEX        │
                                │   • found → use form      │
                                │   • empty form → drop     │
                                │   • missing → keep verbatim│
                                └─────────────┬─────────────┘
                                              ▼
                                  primary, partial, coverage, missing[]
```

| Tier | Source | Status | Size | Notes |
|---|---|---|---|---|
| **1 — Bundled rows** | `src/lib/data/seed.ts` | ✅ done | ~110 rows × 5 langs | One JS file. Greetings, pronouns, verbs, nouns, adjectives, numbers, prepositions, time, idioms. Aliases supported. |
| **2 — Tokenized fallback** | same data | ✅ done | — | Splits on whitespace + punctuation, word-by-word lookup, passes unknown words through, drops intentionally-empty target forms (e.g. RU articles). |
| **3 — IndexedDB bulk dict** | Downloadable JSON shard, persisted client-side | planned | ~10–50 MB / pair | User taps "Get full EN-SV dictionary". Stored in IndexedDB. The provider checks client cache first via SWR. |
| **4 — Server SQLite** | FreeDict / Wiktextract dump | planned | ~200 MB | `better-sqlite3` behind `/api/translate?provider=local`. Lets phones stay light while still hitting a rich dictionary. |

**Why this beats Google Translate for daily-use:**
- Tier 1 is **instant** (sub-millisecond, no network).
- Tier 2 means *any* phrase made of known words translates immediately offline. The result is honestly labelled "Approximate (X % covered)" when it's word-by-word rather than idiomatic.
- Tiers 3/4 give unlimited free coverage once added; nothing else in the stack needs to change.

**Importing free dictionary data (Tier 3/4 recipe):**
1. Download FreeDict EN-XX or Wiktextract per-lang JSON.
2. Filter to source forms + best translations + part-of-speech.
3. Emit a `Row[]` JSON shard per language pair, gzipped, served from `/public/dicts/`.
4. On first lookup for that pair, fetch + decompress + `INDEX = build(ROWS)` client-side. Persist to IndexedDB. From then on it's offline.

---

## 11. Roadmap

**v0.1** — 4-pane lookup, EN/DA/DE/RU, 4 providers wired. ✅
**v0.2** — Live voice mode, Swedish, free-by-default tier, MyMemory + LibreTranslate, server-side LRU cache, PWA manifest, iOS-ready, Vitest. ✅
**v0.3 (this)** — Refactored row-based multilingual dictionary (~110 entries), tokenized word-by-word fallback so multi-word inputs **always** return something usable offline. ✅
**v0.4 (this)** — Rebrand to **TransLang AI**, new gradient T→T logo, **voice picker** (lists device's installed voices per language, persisted), continuous-listening with explicit stop buttons (mic + speaker morph into red stop squares while active), **executive summary** on stop for ≥500-word translations (Claude when key set, deterministic extractive fallback otherwise), Lingva provider added (free Google proxy), better failure-state rendering in Compare panels, **anti-echo voice pipeline** (pause-during-TTS + iOS restart-delay + final-segment dedup + smarter auto-speak). ✅
**v0.5** — Downloadable FreeDict / Wiktextract shards stored in IndexedDB (Tier 3). Per-pair "Get full offline dictionary" button. Language auto-detect. History & pinned favorites.
**v0.6** — More online providers (Reverso, Linguee, Wiktionary REST, InfoDanish, Duden, Gramota), macOS Dictionary via Tauri.
**v1.0 (native)** — Tauri wrapper, global hotkey ⌘⇧D, macOS Services "Translate Selection".

---

## 11. Open Questions (defaults chosen, easy to change)

1. **Mode**: Live or Compare on first open? — **Live**. Better demo, more delightful on phone.
2. **Free mode default**: ON. Friend's deploy never bills him by accident.
3. **Default 4 panels (Compare)**: Local · MyMemory · LibreTranslate · LLM (LLM panel will say "add a key" until one is set, which is fine).
