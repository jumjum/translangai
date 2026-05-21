# TransLang AI — Design Specification (v0.10 — Pairs redesign queued)

> Any-to-any dictionary & **omni-translator** for daily use. Multiple sources side-by-side. Web first, mobile-first UI, voice in/out, native macOS later.

---

## 1. Product Goals

1. **Faster + smarter than Google Translate / TranSync** for everyday lookups.
2. **Any-to-any** between **English, Russian, Danish, German, Swedish, Portuguese, Polish, Spanish** from day one (56 directed pairs).
3. **Words, phrases, idioms, figures of speech** — idioms map to *local equivalents*, not literal translations.
4. **Multi-source parallel view** — see what 4 different engines say at once.
5. **Voice in + voice out** — speak in any supported language, see live transcription, hear the translation spoken back.
6. **Free by default, paid only on opt-in** — three free providers always wired (Local seed dict, MyMemory, LibreTranslate). DeepL & LLM panels exist but are gated by "Free mode" so a friend's deploy never accidentally bills them.
7. **Path to native macOS** — global hotkey + right-click "Translate selection" anywhere.

---

## 2. Non-Goals (for MVP)

- Document translation, OCR — later.
- Accounts / cloud sync — local storage only for v0.x.
- Languages outside EN / RU / DA / DE / SV / PT / PL / ES.

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
| **SpeechRecognition (ASR)** | ✅ native | ✅ (Siri Dictation must be enabled) | ✅ | iOS auto-ends after pause → we restart on `onend` while user intent is "listening". Chrome Android fires incremental finals — handled via `lastFinalRef` replace-rather-than-append. |
| **speechSynthesis (TTS)** | ✅ | ✅ (voices load async) | ✅ | We wait on the `voiceschanged` event before picking a voice. |
| **Microphone permission** | https only | https only | https only | Vercel preview/production URLs are https. |
| **Dark mode** | ✅ system | ✅ system | ✅ system | `prefers-color-scheme` in CSS. |
| **Localized recognition** | en-US / ru-RU / da-DK / de-DE / sv-SE / pt-BR | same | same | Languages stored as BCP-47 in `LANG_META`. |

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

Run with `npm test`. Suite (43 tests, 5 files):

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
| **1 — Bundled rows** | `src/lib/data/seed.ts` | ✅ done | ~110 rows × 6 langs | One JS file. Greetings, pronouns, verbs, nouns, adjectives, numbers, prepositions, time, idioms. Aliases supported. |
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
**v0.3** — Refactored row-based multilingual dictionary (~110 entries), tokenized word-by-word fallback so multi-word inputs **always** return something usable offline. ✅
**v0.4** — Rebrand to **TransLang AI**, new gradient T→T logo, **voice picker** (lists device's installed voices per language, persisted), continuous-listening with explicit stop buttons (mic + speaker morph into red stop squares while active), **executive summary** on stop for ≥500-word translations (Claude when key set, deterministic extractive fallback otherwise), Lingva provider added (free Google proxy), better failure-state rendering in Compare panels, **anti-echo voice pipeline** (pause-during-TTS + iOS restart-delay + final-segment dedup + smarter auto-speak). ✅
**v0.5** — **Portuguese (pt-BR)** added as 6th language — 30 directed pairs, full seed coverage (~110 entries), DeepL PT-BR code, ASR `pt-BR`, all free providers work natively. **Chrome Android incremental-final fix** — `lastFinalRef` replace-rather-than-append prevents cascading word duplication. ✅
**v0.6** — **History sidebar** (ChatGPT-style fly-in left pane). Sessions ≥ 2 minutes auto-save with transcription + translation + executive summary; each row is one line with miniature `src→tgt` flag pair, timestamp, duration, and per-row delete. Click any row to restore the session into Live mode (no re-translate API call). Persisted to localStorage, cap 50 entries. ✅
**v0.7 (this)** — **Grayscale Culture/LCARS rebrand** (circuit-board SVG background, monospace provider section codes). **Offline-first PWA service worker**. **Tauri 2 desktop scaffold** for macOS + Windows — remote-URL mode keeps the existing Next.js backend intact. ✅
**v0.8** — Native global hotkey ⌘⇧D / Ctrl+Shift+D wired through `tauri-plugin-global-shortcut`, macOS menu bar, "Translate Selection" Service. Test Tauri 2 mobile (Android / iOS) build target.
**v0.9** — Downloadable FreeDict / Wiktextract shards stored in IndexedDB (Tier 3). Per-pair "Get full offline dictionary" button. Language auto-detect. Pinned favourites.
**v1.0** — Public Tauri release for macOS + Windows. Play Store TWA wrapper for Android (zero rewrite, lists the PWA as a native app).

---

## 12. Cross-platform architecture (v0.7 forward)

**Decision (2026-05-20): PWA-first + Tauri 2 shell.** Considered Flutter; rejected because (a) the Web Speech API on Flutter Web is JS-interop to the same browser API we already use, with worse error handling, (b) a Dart rewrite would scrap ~65% of the code for marginal gain, (c) Flutter Web ships a ~2MB Skia engine before our code loads — bad for a PWA that needs to feel instant.

### Targets and code sharing

| Target | Stack | Code reused | Effort to ship |
|---|---|---|---|
| **Web (PWA)** | Next.js 16 + service worker | 100% | Continuous (Vercel auto-deploy on push to `main`) |
| **Android (PWA)** | Add-to-Home-Screen today; Play Store via TWA later | 100% | A2HS: 0. TWA wrapper: ~1 day |
| **iOS (PWA)** | Add-to-Home-Screen via Share sheet | 100% | 0 |
| **macOS** | Tauri 2 native window → remote-URL mode → loads translangai.vercel.app | ~95% (Rust shell only) | First binary: hours |
| **Windows** | same | ~95% | hours |
| **Linux** | same (free byproduct) | ~95% | hours |

### Remote-URL mode rationale

The Tauri window points at `https://translangai.vercel.app/` rather than bundling a static frontend. Reasons:

1. Web app has server-side API routes (`/api/translate`, `/api/summarize`); they need a Node runtime — Vercel already runs that.
2. Auto-update is free — every `git push` to `main` updates the web app, which is what the desktop window loads on next launch.
3. No code split — the same `LiveTranslator`, `CompareView`, history sidebar are what you see on every platform. Visual parity is automatic, not a maintenance burden.

Tradeoff: requires internet. For TransLang AI this is fine — every provider already needs network. The only purely-offline path is the local seed dictionary (Tier 1/2), which works in the PWA via cached shell + already-loaded JS.

### Adding native features later

Native-only capabilities land in `src-tauri/src/lib.rs` and call into the web frontend via Tauri's IPC:

- **Global hotkey** (`tauri-plugin-global-shortcut`, already declared): register `⌘⇧D` / `Ctrl+Shift+D`, focus the window, optionally invoke a JS function to start listening.
- **macOS Services** ("Translate Selection") — handled via `Info.plist` `NSServices` declaration + a Rust handler that posts the selected text into the webview.
- **System tray** — `tauri::tray::TrayIconBuilder`.
- **Deep links** — `tauri-plugin-deep-link`.

These features attach to the webview without touching the web code.

### Fork possibilities considered

| Path | When to take it | Cost | Why we didn't pick it now |
|---|---|---|---|
| **React Native + Expo** for iOS/Android | If PWA mobile genuinely underperforms (user complaint, not theory) | 4–6 weeks, monorepo restructure into `apps/web` + `apps/mobile` + `packages/core` | Premature — PWAs cover ~90% of cases for translator apps |
| **Tauri 2 mobile** | Once Tauri's iOS/Android target matures past 2.x | weeks (mostly icon + signing work) | Worth trying before React Native; same Rust + web stack we already have |
| **Flutter** | Never, for this app | 6–10 weeks rewrite | See §12 decision rationale |
| **Electron** | Never | similar to Tauri | Tauri 2 binaries are ~5MB vs Electron's ~120MB; the choice is obvious |
| **Capacitor / Ionic** | If we ever need deep iOS Safari integration not possible via PWA | 1–2 weeks | Tauri 2 mobile beats it on output binary size and language ergonomics |
| **Supabase / Firebase sync** | When we add multi-device history sync, accounts, or shared dictionaries | 3–5 days for Supabase (preferred — Postgres, open source, no lock-in) | No accounts feature yet; premature |

### Build pipeline (planned)

Today: GitHub → Vercel auto-deploy. Web shipping is solved.

Phase 2 (when first Tauri release matters): GitHub Actions matrix builds `macos-latest` + `windows-latest`, runs `cargo tauri build`, uploads `.dmg` / `.msi` to a Releases page. ~1 hour to wire up using `tauri-action`.

---

## 13. Live-translator views (v0.10 — Pairs redesign queued for v0.11)

Three layouts toggle via a segmented pill in the toolbar. Choice is persisted per device in `localStorage` key `translangai:view`. A fourth column-pair view is planned.

| View | When it's best | How it renders |
|---|---|---|
| **Split** (default) | Single thought / a few sentences. The mental model most users come in with. | Source pane (content-sized, auto-grows) → mic+speaker+clear cluster → translation pane (content-sized). Page scrolls; panes never collapse on blur. |
| **Pairs** (Paragraph) — **redesign queued** | Following a lecture / speech / sermon in real time. Reading both transcription and translation comfortably without the eye jumping between distant panes. | See §13.1 below. |
| **Stream** | Live simultaneous interpretation. | **Single container** with two independently-scrolling halves separated by a thin rule. Scrolling one half drives the other proportionally so the matching translation segment stays in view (re-entry guard prevents echo). Sticks to the bottom on new content unless the user scrolled away. Top half has an editable textarea when not listening, live transcript when listening. |
| **Columns** (planned) | Tablet / desktop landscape, side-by-side proofreading. | Source on left, target on right, both scroll. |

### 13.1 Pairs view — the "scrolling teleprompter" model (planned)

The design goal is a single text region that **is** the conversation: a continuous vertical flow of source-then-translation paragraph pairs, where the active paragraph (the one the user is typing or dictating into) sits at the bottom and committed pairs scroll upward as new ones arrive. The reader's eye stays in a narrow band — source paragraph immediately above its translation — so you can follow a lecture or speech without the focus jump between two distant panes that Split and Stream layouts impose.

Visual model:

```
┌─ committed pair 1 ────────────────────┐
│ 🇸🇪 source paragraph 1                 │
│ ───── (thin rule)                      │
│ 🇬🇧 translation paragraph 1            │
├────────────────────────────────────────┤
│ 🇸🇪 source paragraph 2                 │
│ ─────                                  │
│ 🇬🇧 translation paragraph 2            │
├─ active pair (cursor here) ───────────┤
│ 🇸🇪 |what I'm typing right now…        │  ← editable, has the caret
│ ─────                                  │
│ 🇬🇧 live translation as I type         │  ← updates with each keystroke
└────────────────────────────────────────┘
```

**Mechanics:**

1. **Single editable region** — only the source half of the bottom (active) pair. The caret lives there. Earlier paragraphs are read-only.
2. **Live translation** below the active source, separated by a thin rule. Updates with every keystroke (debounced 220 ms, same as the existing translate effect).
3. **Commit triggers** — the active pair "freezes" into the read-only stack above and a fresh empty active pair appears below it when **any** of:
   - source ends with `.` `?` `!` AND has ≥ 20 words
   - source has ≥ 60 words even without terminal punctuation
   - user presses `Enter` twice in succession (explicit hard break)
   - source goes silent for ≥ 3 s while microphone is active (natural speech pause)
4. **Auto-scroll** keeps the active pair always visible near the bottom. The committed history is just above it — the eye doesn't leave a vertical band ~2 paragraphs tall.
5. **Reverse-direction button** flips *every* pair: src text becomes tgt text and vice versa, in the new src/tgt languages. The active pair flips too. Future translations run in the new direction.

**Data model:**

```ts
type Pair = { id: string; src: string; tgt: string };
type PairsState = {
  committed: Pair[];     // frozen, read-only
  activeSrc: string;     // what the user is typing right now
  activeTgt: string;     // live translation of activeSrc (re-runs on edits)
};
```

`committed` accumulates indefinitely (capped at ~200 entries before FIFO eviction so the DOM stays sane on multi-hour sessions). Optionally persist `committed` to localStorage alongside history sessions (open question — see §15).

**Per-paragraph translation cost:**

Once a pair commits, its translation is frozen — no further API calls for it. Only `activeSrc` triggers debounced retranslation. So a 30-minute lecture with ~60 commit events makes ~60 final translations plus the ~debounced-N intermediates while typing each — comparable to today's cost in Split view.

**Resolves the "Enter not transferred" bug naturally**, because Enter (double) is a first-class commit signal, not whitespace that the translation engine silently drops.

### Segmenting (current Pairs implementation, to be retired)

For the current Pairs view we don't make per-paragraph translation calls. Instead we sentence-split the *single full-text* translation that's already been returned and group sentences into ~25-word paragraphs, zipping source and target paragraphs by index. Counts won't always align (one source sentence can become two target sentences); the UI tolerates this by leaving the unmatched slot empty. Lives in `src/lib/segmenter.ts`. The v0.11 redesign replaces this with the per-paragraph model above.

### Sticky-bottom scrolling

`useStickyBottom(dep)` in `src/lib/segmenter.ts`. Tracks whether the container is within 24px of its bottom; if yes, content growth scrolls to bottom automatically. If the user scrolls up to read older content the auto-scroll yields — scrolling back down re-engages it. The new Pairs design keeps this hook unchanged.

### Per-textarea `lang` attribute (OS dictation hint)

Every source textarea declares `lang={LANG_META[src].bcp47}` (e.g. `lang="pl-PL"`). This is a hint to the browser / OS for **dictation, spellcheck, autocorrect, and autocapitalization** — Safari iOS respects it when you tap the microphone key on the system keyboard, Chrome respects it for spellcheck underlines. It **does not switch the OS keyboard layout** — web pages have no permission to do that on any platform. True keyboard-layout switching is reserved for the native shells (Tauri on desktop, eventually Tauri-mobile or React Native), which can call OS APIs.

### Source pane no-collapse fix

The earlier bug ("top pane shrinks when I click the bottom pane") came from both panes being `flex-1` inside a `flex-col` parent — they competed for vertical space, so focus shifts shifted the visible split. Fix: drop `flex-1` on both panes, let the page scroll naturally. The textarea grows with content via the callback-ref pattern in `useAutoGrowTextarea` (re-measures on both mount and value change).

---

## 14. DevBadges (dev / test only)

Numbered overlays attached to every interactive component. Lets feedback reference parts by number ("in stream view, component 5 should…"). Strictly NODE_ENV-gated in `src/components/DevBadge.tsx` — Vercel production builds never render them. Local opt-out via `?nodev=1`.

Number convention per view:
- 1 = source pane / paragraph pairs list
- 2 = mic button
- 3 = speaker button
- 4 = clear button
- 5 = target pane
- 6 = language bar
- 7 = view switcher
- 9 = auto-speak toggle
- `H` = history button

---

## 15. Open Questions (defaults chosen, easy to change)

1. **Mode**: Live or Compare on first open? — **Live**. Better demo, more delightful on phone.
2. **Free mode default**: ON. Friend's deploy never bills him by accident.
3. **Default 4 panels (Compare)**: Local · MyMemory · Lingva · LLM (LLM panel will say "add a key" until one is set, which is fine).
4. **Desktop shell loads remote URL or static export?** — **Remote URL** for v0.7. Revisit if we ever decouple the backend.
