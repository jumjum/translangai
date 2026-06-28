# TransLang AI — Design Specification (v0.12.1)

> §28 (version drift + ASR diagnostic): every JS bundle bakes in `APP_VERSION` from `package.json` plus the Vercel `VERCEL_GIT_COMMIT_SHA`. The R&D drawer's Build section fetches `/api/version` and compares — divergence means the browser is on a stale service-worker / CDN cache. One-click hard reload from the drawer. ASR section surfaces whether the Web Speech API is available and which BCP-47 tags the app will request, so language-pack diagnostics ("Swedish doesn't pick up audio") have a starting point.

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

## 13. Live-translator views (v0.11)

Three layouts toggle via a segmented pill in the toolbar. Choice is persisted per device in `localStorage` key `translangai:view`. A fourth column-pair view is planned.

| View | When it's best | How it renders |
|---|---|---|
| **Split** (default) | Single thought / a few sentences. The mental model most users come in with. | Source pane (content-sized, auto-grows) → mic+speaker+clear cluster → translation pane (content-sized). Page scrolls; panes never collapse on blur. |
| **Pairs** (Paragraph) | Following a lecture / speech / sermon in real time. Reading both transcription and translation comfortably without the eye jumping between distant panes. | See §13.1 below — scrolling teleprompter, single editable region. |
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

## 15. Transcription mode (queued — design only, implementation v0.12)

**Trigger:** picking the same language for source and target in the new combined picker switches the UI into a single-pane transcription mode. No translation is performed — the user is just dictating, capturing audio, or ingesting an audio file for transcription.

**Layout:**

```
┌─────────────────────────────────────────┐
│ Toolbar: [pair-mic] [🇸🇪 → 🇸🇪]          │
├─────────────────────────────────────────┤
│            ●   ▶                        │  ← mic + (optional) playback
│         live transcription              │
├─────────────────────────────────────────┤
│ 🇸🇪 Svenska                              │
│ … transcribed text grows here …         │
│                       [▶ speak] [⎘ copy]│
│                       [Σ summarise]     │
└─────────────────────────────────────────┘
```

**Input sources** (one click each in the mic cluster):
- **Mic** — live voice capture (current Web Speech path). Largest button, central.
- **Drop a file** — text or audio. Audio gets sent to a transcription service (Whisper API at ~$0.006/min when we wire it, see §17). Text is pasted as-is.
- **Paste a URL** — streaming source (YouTube link, podcast feed, direct audio URL). Resolved client-side when possible, server-side when not.
- **Paste text** — keyboard paste lands in the field; nothing special needed.

**Buttons exposed:**
- Mic toggle (start/stop) — large.
- Copy field text — small, bottom-right of the field.
- Speak field text — small, beside Copy.
- **Summarise** — sends the transcribed text to `/api/summarize` (already exists). Produces an executive summary card below the transcript.

**Why this matters:** transcription is the second most common voice-text workflow after translation. Adding it costs essentially zero — we already have the recogniser, the summary endpoint, the copy/speak actions, the history sidebar — they just compose differently when src===tgt. The user already wanted "voice memo with one button"; this gives them that *and* the same UI doubles as a translation transcript view (if they later swap target away from source, the transcript becomes the source of a translation).

**Implementation outline:**
1. Detect same-language pair in `LiveTranslator` and switch view to a new `TranscribeLayout` that doesn't render a target pane.
2. Hook up `summary` state (already used by Pairs auto-summary) to a manual button.
3. File / URL ingestion handled in §17.

---

## 16. Universal input — files, URLs, drag-drop (queued, v0.13)

The Live source field becomes a drop zone (HTML5 `dragover`/`drop` events) accepting:

| Drop | Action |
|---|---|
| **Text file** (`.txt`, `.md`, `.srt`, `.vtt`) | Read with `FileReader.readAsText`, inject into the source. |
| **Audio file** (`.mp3`, `.m4a`, `.wav`, `.ogg`, `.webm`) | Upload to `/api/transcribe` → Whisper. Result lands in the source field. Play button appears beside the file name so the user can scrub. |
| **PDF** | Extract text via `pdfjs-dist` (already a peer dep of many tools, ~200KB gzipped). Inject. |
| **YouTube / podcast URL** | Backend fetches caption track if available (free); else queues a Whisper transcription (paid). |
| **Image** | OCR via Tesseract.js (client-side, free, slow). Phase-2. |

Visual feedback: file chip appears in the source field with name + size + ✕ remove. While transcribing, the chip shows a small progress ring.

This is the *single feature* most distinguishes us from Google Translate, which only accepts typed/spoken text in the same session. We become a universal in-tray for any translation/transcription task.

**Cost gate:** Whisper is the only billable line item here. Default behaviour: free up to N minutes/day per IP, then BYO-key prompt. Tracked via the same LRU cache + IP-hash bucket as we'd do for any usage gate.

---

## 17. Competitive landscape (snapshot, May 2026)

A short scan of where we stand vs. the obvious incumbents — kept brief because the landscape rots quickly and the spec is read at fail time, not as a marketing deck.

| Tool | Strength | What we have that they don't | What they have that we don't |
|---|---|---|---|
| **Google Translate** | 100+ langs, camera, document, mature web/app/API. | Multi-source compare, idiom-aware LLM panel, 4 view modes, history sidebar, free-by-default, zero account, open source. | Camera-text OCR, 100-lang coverage, brand trust. |
| **DeepL** | Best-in-class quality (esp. DE/FR/EN/RU). Document. | Multi-source view that includes DeepL alongside others — they're a *panel* for us, not a competitor. | Highest single-engine quality, formal/informal tone, glossaries. |
| **Apple Translate** | On-device, conversation mode, iOS integration. | Browser-first, no app install needed, cross-platform, more languages, multi-source compare, pairs/stream views. | True on-device for some langs (privacy); iOS Shortcuts. |
| **Microsoft Translator** | Conversation rooms (multi-user), Office integration. | Cleaner UX, no account, much smaller bundle, BYO-key option for power users. | Multi-user conversation rooms, Office plug-in. |
| **iTranslate / TranSync / Notta** | Voice-first; transcription. | Free-tier without sign-up, multi-source compare, view variety, paragraph-pair UX. | Pro features locked behind subscription. |
| **Otter.ai / Rev** | Speaker-diarised transcription, meeting recording. | Translation alongside transcription; no account. | Speaker diarisation, meeting calendar integration. |
| **OpenAI Whisper (API)** | Best-in-class transcription quality. | Wrap them as a provider in our `/api/transcribe` (§16). | They're an engine, not an app. |

### Our actual moat (today)

1. **Multi-source side-by-side comparison** — nobody else lets you see DeepL, Lingva, MyMemory, LLM, local dictionary on one screen for the same input. This is the differentiator.
2. **Four view modes** (Split, Pairs scrolling-teleprompter, Stream, Compare) — purpose-built for distinct reading rhythms (lookup vs. lecture vs. simultaneous).
3. **Zero-account, zero-cost default** — Free providers wired with no key, server cache, no usage tracking. A user-hostile move by everyone else.
4. **Voice-pair detection** — say a language pair, both chips update. Tiny but uniquely friction-free.
5. **Pairs view as a teleprompter** — reading a lecture transcript live in two languages, in a single column, is something only we do.

### Our actual gaps

1. No image / camera OCR (Google's strongest mobile feature).
2. No native mobile app yet (Tauri mobile is scaffolded, not shipped).
3. No multi-user / shared conversation (Microsoft's edge — though arguably out of scope).
4. No offline mode beyond the local seed dictionary (Apple's edge for travellers).

---

## 18. Monetization — when "must" vs "want" (planned, no rush)

Right now we cost **near-zero** to run: Vercel free tier, free providers, server LRU cache. No reason to charge.

Things that would force a paid tier (in priority of likelihood):

1. **Vercel quota** (most likely first trigger). Free tier: 100 GB-hours/month compute, 100 GB bandwidth. We'll hit this around ~50–200 active daily users depending on traffic shape. Mitigation: aggressive edge caching, then Hobby → Pro ($20/mo) buys us 6× headroom. Probably enough until ~5k DAU.
2. **LLM costs** (Anthropic / Gemini / Groq). Currently the user adds their own key — zero cost to us. If we ever offer a built-in "Pro translation" tier with our key, that's where charging starts. Estimate: $0.001–$0.01 per translation depending on model. A free Pro trial of 100 translations/month would cost ~$0.10–1 per active user.
3. **Whisper transcription** (§16). Each minute of audio = $0.006. A free quota of 30 min/day per user = $0.18/user/day max. Either gate via BYO-key (preferred) or sell a "Transcription Pro" tier at e.g. $5/mo for 500 min.
4. **History sync across devices** — needs accounts + Supabase. Optional add-on, ~$3/mo seems right.

### Recommended ladder

| Tier | Price | What's in | What's not |
|---|---|---|---|
| **Free** (today) | $0 | All current features incl. multi-source compare, voice, history (local-only), all 4 views, transcription with BYO Whisper key. | LLM translation requires user's own key. Cross-device sync. |
| **Pro** (future) | $5–8/mo | LLM idiom translation included, 500 min/mo transcription included, cross-device sync, no rate limits. | Speaker diarisation, custom glossaries (Plus tier). |
| **Plus** (later) | $15/mo | Above + speaker diarisation, glossaries, priority queue, custom subdomain. | — |

**When to start charging:** only when (a) Vercel bills us; or (b) we have ≥100 paying-intent users asking for LLM-included; or (c) we ship Whisper transcription and a Pro tier becomes natural. Not before — premature monetization kills growth on a tool like this.

---

## 19. Open Questions (defaults chosen, easy to change)

1. **Mode**: Live or Compare on first open? — **Live**. Better demo, more delightful on phone.
2. **Free mode default**: ON. Friend's deploy never bills him by accident.
3. **Default 4 panels (Compare)**: Local · MyMemory · Lingva · LLM (LLM panel will say "add a key" until one is set, which is fine).
4. **Desktop shell loads remote URL or static export?** — **Remote URL** for v0.7. Revisit if we ever decouple the backend.
5. **Picker layout**: Combined two-column src/tgt picker (v0.11.2) — replaced the single-column per-chip dropdown. Same click count for changing one side, one fewer click for changing both.

---

## 22. Speech-recognition quality (Swedish & co.)

**The gap.** Web Speech API quality is fixed per browser+OS. Chrome on Android uses Google's recogniser which is excellent for English, decent for major European languages, and noticeably weaker for less-common ones (Swedish, Polish, Danish at the user-observed end). Punctuation is rarely emitted by any browser. We cannot pick a different engine inside the browser.

**Three remedies, in order of cost-effectiveness:**

1. **LLM punctuation polish (recommended, v0.12).** After each commit (or on-demand from a button), send the active paragraph's raw transcript to a small model (Claude Haiku, Gemini Flash, GPT-4o-mini) with a 3-line prompt: *"Add punctuation and capitalisation to this {{lang}} transcript. Fix obvious mishears using context. Return only the corrected text."* Cost: ~$0.0005 per ~50-word paragraph at Haiku rates. Free providers don't do this — it's a Pro-tier feature, and gated behind "Free mode" being off. Local seed dictionary can do a very crude version of capitalisation-after-period for $0.
   - **Implementation sketch**: new `/api/polish?lang=sv` endpoint, POST `{ text }`, returns `{ polished, provider, ms }`. Wire into the commit pipeline in Pairs view. Cache results in the same LRU as translations.
2. **Cloud Whisper for dictation (v0.13 with §16 audio files).** Same `/api/transcribe` endpoint that handles dropped audio files can also accept a short browser-recorded audio blob. Whisper-large punctuates and capitalises far better than browser ASR — and handles Swedish well. Cost: ~$0.006/min. Toggle in settings: "Better transcription (paid)".
3. **Self-hosted Whisper (later, on-prem only).** For the medical/firewall verticals (§24) we'll need this anyway. `whisper.cpp` runs at near-real-time on consumer hardware.

**v0.11.x stopgap:** keep displaying raw transcript honestly. Add a small "✨ polish" button to the Pairs / Transcribe summary cluster that calls the v0.12 endpoint when implemented.

---

## 23. Multi-user "linked phones" — paired conversation mode

**The problem.** Today: two non-shared-language people use Google Translate by passing one phone back and forth, switching the language direction each time. Or "two-mic" conversation modes (Apple / Google) where one phone tries to listen to two speakers — the mic is only oriented to one person, so the other gets terrible recognition.

**The proposal.** Each person uses **their own phone**. The two phones pair (QR or short code) into a single conversation session. Each phone runs locally-optimal recognition for its owner's voice. Transcripts (text, not audio) sync between devices in real time. Both phones show both sides of the conversation; either can speak the latest translation aloud through their own headphones / earpiece.

**Why it's better than every existing solution:**
- Each mic is oriented to its dedicated speaker → recognition quality is as good as solo dictation.
- Eye contact preserved — no passing, no holding the phone between you.
- Both speakers see the full transcript on their own screens.
- Audio out can be earphone-only, so neither phone needs to play out loud (great in cafés, plane seats).
- No special hardware (Pocketalk etc.).

**Technical design.**

- **Transport**: WebRTC DataChannel for peer-to-peer text sync. Free STUN servers (Google's, Cloudflare's). TURN only needed for very-restrictive NATs — add an optional self-hosted TURN later. No audio crosses the network; each device's recogniser stays local.
- **Pairing**: phone A shows a QR with a short-lived session token + WebRTC offer. Phone B scans → handshake. Alternative: 6-digit short code via a tiny signalling relay on Vercel (~10 lines).
- **Privacy**: audio never leaves either device. Only the agreed-upon transcript + translation text. No accounts, no server log.
- **UI**: a new "Pair" view alongside Split/Pairs/Stream/Transcribe. Same chat-paradigm layout, but each speaker's bubble is tagged with `me` / `them`. Tapping a bubble plays it aloud in your headphones.
- **Setup time estimate**: ~1–2 weeks of focused work (~200 lines WebRTC setup, ~150 lines pairing UI, ~150 lines state sync, ~200 lines new view). Doesn't touch the existing translation pipeline.

**Risks / open questions.**
- WebRTC + iOS Safari: works as of iOS 14.5 but the API surface is quirky. Test early.
- Battery: continuous mic + WebRTC will eat ~10–15% battery per hour. Acceptable for a translator app used in 5–30 min bursts.
- Discoverability: most users won't realise this exists. Add a "Conversation mode" entry point in the header beside Live / Compare.

**Validation:** none of Google / Apple / Microsoft / Otter / Pocketalk do this exact pattern. Plausible candidate for our most-distinctive feature. Worth a prototype next quarter.

---

## 24. Modular TransLangAI — verticals and on-prem

**The path.** Make the codebase a **pnpm workspace monorepo** so each vertical is an `apps/<name>` that composes the same shared `packages/core` (providers, types, LRU cache, history, segmenter, i18n) plus `packages/ui` (LiveTranslator, CompareView, HistoryPanel, ChatComposer, etc.). Per-vertical apps customise: branding, available providers, feature flags, optional templates / glossaries / forms, optional behind-firewall deployment.

| Vertical | What's different vs. consumer | Stack additions |
|---|---|---|
| **Medical** (clinics, hospitals) | HIPAA-ready audit log, no third-party LLMs by default, PII redaction before any cloud call, SOAP / OPQRST templates, ICD-10 glossary, encrypted local history (Hive + libsodium). On-prem option mandatory. | Self-hosted Whisper, self-hosted Llama-3-Med / Meditron, Keycloak SSO, Postgres + pgcrypto, audit log to OpenSearch, optional MinIO for audio storage. |
| **Police / law enforcement** | Chain-of-custody log, evidence-grade timestamps, multi-speaker diarisation, immutable transcript signing, glossary of legal/criminal terms. | Whisper-large with diarisation (pyannote), hash-chain log, hardware-backed signing (Yubikey) for on-prem builds. |
| **Insurance / claims** | Form-fill templates (claim taxonomy), photo-attachment OCR, summary into structured JSON, integration hooks (Zapier / webhook). | Tesseract OCR (§25), JSON-schema output mode for LLMs, webhook signing. |
| **Consumer** (current) | Free providers default, public LLMs opt-in, history local-only. | Current stack — no change. |

**Deployment shapes:**
- **SaaS** for consumer + small-team verticals → current Vercel deploy + Supabase auth + optional Supabase storage. Annual or monthly per-seat.
- **On-prem** for hospitals / police / classified deployments → Docker Compose / Helm chart bundle: Next.js app + Postgres + Whisper service + Llama service + Keycloak. No outbound network required. Annual licence + support contract.

**Refactor cost to get to monorepo:**
- pnpm workspace setup + `packages/core` extraction: ~1 week.
- `packages/ui` extraction: ~1 week.
- First vertical app shell (medical) as a thin wrapper: ~3–4 days.
- Self-hosted Whisper + Llama Docker images: ~1 week.
- Audit log + PII redaction modules: ~1 week.
- **Total to first medical pilot**: ~5–6 weeks.

**Smartest first step:** keep the current single-repo single-app structure for another 2–3 months while consumer iteration continues, **but**:
- Move all business logic out of `src/components/*` into `src/lib/*` already (mostly done — providers, segmenter, history, i18n, langPairStats are all in `lib/`).
- Keep component files free of external-API specifics (already true).
- When the first vertical interest is real (paying pilot or LOI), spend the 5–6 weeks. Don't pre-build it.

---

## 25. Camera OCR (drop image → text)

Open-source pipeline, no external API needed for the default tier.

| Layer | Choice | Why |
|---|---|---|
| OCR engine | **Tesseract.js** (`tesseract.js@5`) | Pure JS/WASM, runs in the browser, no upload. ~10 MB worker downloaded on first use, cached thereafter. Supports 100+ languages. Slow but acceptable for one-off image translations. |
| Image capture | `<input type="file" capture="environment">` → camera prompt on mobile, file dialog on desktop. | Standard browser, no permissions plumbing. |
| Preprocessing | Canvas: greyscale + adaptive threshold + deskew. ~50 lines. | Tesseract's accuracy doubles on cleaned inputs. |
| Wiring | Same drop zone (§16) accepts `image/*` and routes to Tesseract instead of FileReader. | Reuses every existing flow. |
| LLM-OCR fallback (paid) | Claude / Gemini vision endpoints for hard images (photos of street signs, restaurant menus, etc.). | Better than Tesseract for low-quality photos. Optional, behind "Free mode off". |

**Implementation outline**:
1. Add `tesseract.js` as a dep. Dynamic import only when first image is dropped — keeps initial bundle small.
2. `src/lib/ocr.ts`: `recognise(file: File, lang: Lang): Promise<string>`. Wraps Tesseract worker with lang code mapping.
3. Wire into the existing `useFileDrop` handler in LiveTranslator — branch on `file.type.startsWith("image/")`.
4. Show a small "OCR…" progress chip while running.
5. Result lands in the source field, then translation runs as normal.

This closes the single biggest competitive gap vs. Google Translate (camera mode).

---

## 26. Native mobile — Android first, macOS in parallel

**Path of least resistance.** We already have:
- A PWA that installs to home screen (works today on Android Chrome + iOS Safari).
- A Tauri 2 desktop scaffold in `src-tauri/` that loads the remote URL (works today; needs Rust toolchain to compile).

**Step ladder, each step buys some piece of "more native":**

| Step | Effort | Native gain | Cost |
|---|---|---|---|
| 1. **Polish the PWA**: maskable icon (done), splash screen colours (done v0.11.8), service-worker shell cache (done v0.7). | done | A2HS already works. | 0 |
| 2. **Android TWA** (Trusted Web Activity) via Bubblewrap. Wraps the PWA into a Play-Store-distributable APK / AAB. Same code, native shell with no browser chrome. | ~1 day | Play Store listing, slightly nicer launch, can request Notification permission. | $25 Play Store one-time fee |
| 3. **Build the existing Tauri 2 desktop shell**. Install Rust, `cargo tauri build`. Get a real `.app` on macOS and a `.msi` on Windows. | ~half-day | Native window, global hotkey ⌘⇧D, dock icon, macOS Services menu wiring later. | 0 |
| 4. **Tauri 2 mobile (Android first)**. The same Rust shell now targets Android (`cargo tauri android init` + `cargo tauri android build`). Same web app, native APK. Slightly heavier than TWA but gives us native module access (NFC, deep links, native auth). | ~3–5 days | Native modules; no Chrome runtime dependency. | $25 Play (already paid) |
| 5. **Tauri 2 iOS**. Same toolchain. Requires Apple Developer ($99/yr) + macOS for Xcode. | ~3–5 days | App Store presence; native iOS features (Shortcuts integration). | $99/yr |
| 6. **React Native** *only if* we ever genuinely need true-native widgets and Tauri-mobile's webview perf falls short. Today: not needed. | 4–6 weeks | Pixel-perfect native UI. | — |

**Decision: do steps 2 + 3 next. Defer 4–6.** TWA gets us on Play Store this week. Desktop Tauri compile is a one-evening task that gives us a real `.app` to demo. Tauri mobile / RN can wait until we have user signal that the PWA is genuinely insufficient.

**Why not Flutter (re-stated):** see §12. The voice-API parity gap, the bundle-size hit on web, and the language rewrite cost remain the same.

---

## 27. Updated open questions

6. **LLM punctuation polish**: paid-only or include in free tier? — **Paid-only** (Pro). Default off. Otherwise our free-tier API cost is unbounded.
7. **Pair / Conversation mode**: WebRTC P2P or relay through our server? — **P2P** (no audio crosses the network, no privacy concerns). Add an optional relay for restrictive NATs later.
8. **Vertical timeline**: build now or wait for paying interest? — **Wait**. Keep code modular-ready (already mostly is) but don't fork the repo until there's a customer.
