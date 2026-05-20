# Changelog

All notable changes to **TransLang AI** are documented here. The project follows roughly semantic versioning; v1.0 is reserved for the native macOS shell.

---

## [0.6.1] — 2026-05-20

### Changed
- 🔁 **Persistent source text across Live ↔ Compare** — the input is now lifted to page-level shared state, so typing in Compare and switching to Live (or speaking in Live and switching to Compare) keeps the text. Lets you instantly explore what 4 different engines say about the same phrase you just spoke.
- During listening, the committed `speech.finalText` is mirrored into the shared text on every update — so a flip to Compare mid-session still picks up everything heard so far.

---

## [0.6.0] — 2026-05-20

### Added
- 🗂️ **History sidebar** — a fly-in left pane (ChatGPT-style) lists every live-translation session that ran for **2 minutes or longer**. Each row is a single line showing the language pair as miniature flags (`🇬🇧→🇩🇪`), the timestamp ("Today 15:32" / "Yesterday 09:14" / "May 18 14:21"), the duration ("2m 14s"), and a per-row delete button. A "Clear all" button is offered when there's content; closes on Esc or backdrop click.
- 💾 **Auto-save** on stop: when the user taps the stop button (or recognition ends naturally), if the mic was active ≥ 2 minutes, the session — source transcription + final translation + executive summary if generated — is persisted to localStorage (cap 50 entries, FIFO).
- 🔁 **Click-to-restore**: tapping a history row opens that session in Live mode, hydrates the transcription / translation / summary panes, and switches the language pair to match. No re-translate API call is made for restored sessions (`skipNextTranslateRef`).

### Technical
- New `src/lib/history.ts` — `loadSessions`, `saveSession`, `updateSession`, `deleteSession`, `clearHistory`, plus `formatDuration` / `formatWhen` helpers. Reactivity via a `translangai:history` `CustomEvent` on `window` so any mounted panel stays in sync without prop drilling.
- New `src/components/HistoryPanel.tsx` — slide-in panel, safe-area-inset aware, keyboard-accessible (Escape closes), backdrop blur.
- `LiveTranslator` tracks session start (`sessionStartRef`) on listening transitions and patches the saved entry when the summary later arrives (`updateSession`).

---

## [0.5.0] — 2026-05-20

### Added
- 🇧🇷 **Portuguese (pt-BR)** — 6th language, bringing the app to **30 directed pairs**. Full seed-dictionary coverage (~110 entries): greetings, pronouns, verbs, nouns, adjectives, numbers, wh-words, prepositions, conjunctions, time words, and 4 idioms (idiomatic equivalents, not literal translations). Voice input (`pt-BR` BCP-47) and TTS output work on Android Chrome and iOS Safari. All 4 free providers (local, MyMemory, LibreTranslate, Lingva) support Portuguese natively with no extra config. DeepL uses the `PT-BR` code.

### Fixed
- 🤖 **Chrome Android incremental-final transcript stutter** — Chrome fires `isFinal=true` multiple times per utterance with a cumulative transcript ("I don't" → "I don't want" → "I don't want any"). Without handling, each chunk appended, producing "I don't I don't want I don't want any…". Fix: new `lastFinalRef` tracks the last appended segment; if the next final starts with it (Chrome's growing-transcript pattern), the tail is **replaced** rather than appended. `lastFinalRef` resets on every `onstart` so phrases across session restarts are never incorrectly merged. The existing iOS tail-dedup is kept for exact double-fire protection.

### Tests
- 43 passing (5 files) — all existing tests pass; Portuguese is exercised by the seed + providers suites.

---

## [0.4.0] — 2026-05-20

### Added
- 🎨 **Rebrand to TransLang AI** — new gradient T→T logo mark, gradient wordmark in the header, matching favicon and Apple touch icon (PWA Add-to-Home-Screen).
- 🗣️ **Voice picker** — auto-detects every system voice the phone exposes for the current target language (`speechSynthesis.getVoices()` with the Safari async-quirk handled). On-device voices listed first, cloud second. Choice persists per language in `localStorage`.
- ⏹️ **Stop buttons** — while listening, the mic visibly morphs into a red square stop button with `aria-pressed`. While speaking, the speaker button does the same. Continuous listening runs until the user explicitly taps stop.
- 📝 **Executive summary on stop** — when the cumulative translation exceeds 500 words and the user stops listening, the app calls `POST /api/summarize`. With `ANTHROPIC_API_KEY` set → Claude Sonnet 4.5 produces a 3–5-sentence summary in the target language. Without → deterministic extractive fallback (first sentence + longest middle sentence + last sentence), zero cost. UI shows an amber summary card with a "speak summary" button.
- 🌐 **Lingva provider** — third always-free MT source (free Google Translate proxy, no key, multi-instance failover). Now the default 4-slot Compare layout has 3 reliable free sources + 1 LLM upsell slot.
- 🎴 **Friendly failure cards** — Compare panels that can't return a translation now render an icon-led explanation instead of a blank space: padlock for Free-mode block, key for missing API key, wifi-off for network errors, info for vocab misses.

### Fixed — anti-echo voice pipeline 🎧
The "repeated echo of words" bug had four contributing causes; each got its own fix:

1. **TTS feedback loop** — when auto-speak (or manual speaker) played a translation through the phone's speakers, the mic heard it and re-transcribed it. **Fix:** new `pause()` / `resume()` methods on `useSpeechRecognition`. The `LiveTranslator` calls `pause()` when `isSpeaking` becomes true and `resume()` when it ends. The UI's "listening" state stays visible so the user doesn't see flicker.
2. **iOS Safari restart storm** — Safari auto-ends recognition after every natural pause; my prior code restarted synchronously in `onend`, which raced the engine teardown and caused duplicate `onresult(isFinal)` events. **Fix:** ~150 ms `setTimeout` between `onend` and the restart attempt.
3. **Duplicate final results** — even with the delay, some engines occasionally re-fire `onresult(isFinal=true)` for the same phrase on session restart. **Fix:** before appending a final chunk, compare it case-insensitively against the tail of the cumulative transcript; if they match, drop it.
4. **Auto-speak loop trigger** — every interim transcription change debounce-triggered a translate + auto-speak, so partial sentences kept being spoken. **Fix:** auto-speak now only fires when (a) `interim.length === 0` (real pause), (b) the new output isn't a strict-prefix extension of what was just spoken (or the delta is ≥4 chars), and (c) ≥1.2 s since the last utterance.

### Changed
- Auto-speak tooltip explicitly recommends headphones to avoid feedback even with the above fixes.
- DESIGN.md gains §6½ documenting the voice pipeline / anti-echo strategy.

### Tests
- 43 passing (5 files): seed, cache, providers, summarize, speech.
- Added `extractiveSummary` unit tests + voice-list-on-jsdom test.

---

## [0.3.0] — 2026-05-19

### Added
- 📚 **Row-based multilingual dictionary** (~110 entries) keyed by concept rather than per-source-lang. One ROW = forms in all 5 languages + optional POS / IPA / examples / aliases.
- 🧠 **Tokenized word-by-word fallback** (`seedLookupPhrase`) — split on whitespace + punctuation, translate each token, drop intentionally-empty target forms (e.g. Russian articles), pass unknown words through verbatim. Returns `partial: true` + `coverage` + `missingWords` so the UI labels approximations honestly.
- 🎤 **Mic voice input in Compare's SearchInput** via new `micLang` prop.
- 🎯 **Cleaner empty / error states** in Compare panels.

### Fixed
- All 20 directed language pairs now work bidirectionally (previously RU/SV often returned null on reverse lookups).
- Multi-word inputs no longer fail in offline mode; the tokenizer always produces *something* if any word is known.
- Stale Turbopack chunk producing "PRIMARY_PROVIDER is not defined" cleared by killing dev + `rm -rf .next`.

### Tests
- 34 → 37 passing. New: 9 tokenized-phrase tests + 3 Lingva tests.

---

## [0.2.0] — 2026-05-19

### Added
- 🇸🇪 **Swedish (sv)** as a fully supported language across UI + dictionary + DeepL codes (now 5 languages, 20 directed pairs).
- 🎤 **Live mode** — voice-first translator with mic, live source transcription, live translation, optional TTS playback. Default landing mode.
- 🆓 **Free-by-default tier** — three providers wired with no key required: Local (offline seed), MyMemory (~1k words/day), LibreTranslate (self-hostable for unlimited). "Free mode" chip blocks paid providers at the API gateway, not just the client.
- 💾 **Server-side LRU cache** (500 entries, 24 h TTL) — same phrase costs zero on subsequent calls, even across users on one instance.
- 📱 **PWA** — manifest, apple-touch-icon, safe-area-inset handling, `min-h-dvh`, viewport-fit=cover. Add-to-Home-Screen works on iOS Safari + Android Chrome.
- ⚡ **iOS Safari ASR auto-restart** — Web Speech API on iOS auto-ends after a phrase; we restart on `onend` while user intent is "listening" so the session feels continuous.
- 🧪 **Vitest** test suite — 25 tests covering seed, cache, providers, speech support.

### Changed
- Replaced placeholder seed lookup with a real multi-lang structure (later refactored further in v0.3).

---

## [0.1.0] — 2026-05-19

### Added
- Initial MVP: Next.js 16 + TypeScript + Tailwind v4 + React 19.
- 4-pane Compare view with per-slot provider picker.
- Languages: English, Russian, Danish, German.
- Providers: Local dictionary (seed JSON), DeepL (key), LLM (Anthropic, idiom-aware prompt), Thesaurus (LLM-backed).
- `TranslationProvider` interface — single seam for all sources.
- Light/dark mode follows OS preference.
- Language pair + slot config persist in `localStorage`.
- DESIGN.md spec + DEPLOY.md free-deploy guide.

---

## Versioning & release process

- Version is reflected in `package.json` and the top of `DESIGN.md`.
- Each entry above ties to a single coherent slice of work — usually one chat turn.
- Production releases promote the current build to the `translangai.vercel.app` alias.
- To redeploy after changes:
  ```bash
  git add . && git commit -m "vX.Y.Z — short summary"
  git push                              # if linked to GitHub-on-Vercel auto-deploy
  npx vercel@latest --prod              # or manual promote (still works in parallel)
  ```
