# Changelog

All notable changes to **TransLang AI** are documented here. The project follows roughly semantic versioning; v1.0 is reserved for the native macOS shell.

---

## [0.9.0] — 2026-05-21

### Added
- 🇵🇱 **Polish (pl)** as the 7th language — 42 directed pairs. Full seed coverage including idioms (`bułka z masłem` for "piece of cake", `połamania nóg` for "break a leg"). DeepL `PL`, MyMemory `pl`, ASR/TTS `pl-PL`. All free providers work natively.
- **Editable source in Pairs and Stream views** — previously read-only. Both views now expose an auto-growing textarea so the user can type or paste regardless of which view is active.
- **Synchronized scroll in Stream view** — single container with two independently-scrolling halves separated by a thin rule. Scrolling either pane drives the other proportionally so the matching translation segment stays in view. Re-entry guard prevents echo. Sticks to the bottom on new content unless the user has scrolled away.

### Changed
- **Logo strokes / dots ~30% larger** so the Culture-glyph stays legible at favicon size. Applied to `public/icon.svg`, `public/icon-maskable.svg`, the dynamic `icon.tsx` / `apple-icon.tsx`, and the header `Logo` component.
- **Pairs view layout**: mic cluster is now horizontally centered (was left-aligned). The right-anchored flag-pair label was dropped — the language bar already shows it.
- **Source pane no longer shrinks on mic toggle** in Split / Pairs / Stream — wrapped in a `min-h-[4.5rem]` container so the `<p>` (live transcript) and `<textarea>` (manual input) both occupy the same minimum height.
- **Target placeholder copy** — replaced the bare `…` with "Translation will appear here…" in all three views.
- **`lang` attribute** set on every source textarea (`en-US`, `ru-RU`, `pl-PL`, etc.). This is a hint to the OS dictation / spellcheck / autocorrect layer — iOS Safari respects it for the dictation engine, Chrome respects it for spellcheck. **It does not switch the OS keyboard layout** — web pages cannot do that on any platform; only native shells (Tauri / RN) can. Roadmap item for v1.0.

### Removed
- The unused `FlagPair` component (replaced by the language bar itself).

---

## [0.8.1] — 2026-05-21

### Added
- **R&D quick-links drawer** in the lower-right of the footer. One click opens a popover with every URL we use while iterating: local + production, GitHub repo / issues / PRs / actions, Vercel project / deployments / env vars / logs / deployment-protection / domains, provider consoles (Anthropic, Gemini, Groq, DeepL), free-provider docs (MyMemory, LibreTranslate, Lingva), and current-env relative URLs (`/api/translate?ping=1`, `/manifest.webmanifest`, `/sw.js`). Each row has a hover-only copy-URL button. Closes on outside click or Escape. Hide entirely with `?nodev=1`.

### Changed
- Remaining buttons (LanguageBar source/target chips + swap, SearchInput mic, LiveTranslator voice picker label, summary-card "speak summary" button) now use the shared `BTN_HERO` / `BTN_CHIP` grey-gradient recipes from `src/lib/ui.ts`. No more one-off button styles — every button in the app reads from the same recipe file.

---

## [0.8.0] — 2026-05-21

### Added — three live-translator views

- **View switcher** (toolbar, segmented 3-way pill) — `split` / `pairs` / `stream`. Choice persists per device in `localStorage:translangai:view`.
- **Split view** (default, refactored): source pane / mic-cluster / translation pane, panes are **content-sized** (no more `flex-1` competition) so the source stays expanded when you click into the translation. Page scrolls naturally — Google-Translate-style.
- **Paragraph (pairs) view**: single scrollable column. Source text is sentence-split and grouped into ~25-word paragraphs; each paragraph is shown with a thin rule below it followed by the matching translated paragraph. New pairs append and the view auto-scrolls to bottom (sticks to bottom unless the user scrolled up — they get to read in peace). Mic cluster at top, language pair chip at right.
- **Stream view**: split top/bottom panes with fixed height (`28dvh` each); both auto-scroll so the most recent source line and the most recent translation line stay visible — older content scrolls off the top of each pane. Simultaneous-interpretation feel.

### Added — Culture-glyph logo + grey-gradient buttons

- New logo mark: two facing arc brackets (input / output sides) meeting at a central transform node, with thin IO trace lines and endpoint pads on the left / right edges. Abstract, no Latin letters — Culture-series ship-mark feel. Rolled out to `icon.svg`, `icon-maskable.svg`, the Next.js dynamic `icon.tsx` and `apple-icon.tsx`, and the header `Logo` component (which keeps a small chip-frame ring around the glyph).
- New shared button recipes in `src/lib/ui.ts`: `BTN_HERO`, `BTN_CHIP`, `BTN_CHIP_ACTIVE`. Vertical grey gradients with a 1px inset highlight and a soft drop-shadow. Pressed state inverts the gradient and replaces the drop-shadow with an inset shadow — physical "chip pressed in" feel. Applied to the mic, speaker, clear, history button, mode switch, free-mode chip, view switcher, and auto-speak toggle. All dark-mode-aware.

### Added — numbered DevBadges

- New `DevBadge` component shows a small mono-numbered tag on each major UI element (`1 src`, `2 mic`, `3 speak`, `4 clear`, `5 tgt`, `6 lang`, `7 view`, `9 auto`, `H history`, etc). **NODE_ENV-gated** — never rendered in production builds. Toggle off in dev with `?nodev=1`. Lets the user reference components by number when filing feedback.

### Fixed

- **Source pane no longer collapses** when focus shifts to the translation pane. Both panes are now content-sized, the textarea auto-grows up to 12 lines (`useAutoGrowTextarea` callback-ref pattern re-measures on mount and value change), and the page scrolls — same model as Google Translate.

---

## [0.7.0] — 2026-05-20

### Added — cross-platform foundation

- **Grayscale / Culture-LCARS visual rebrand** — every colored class (indigo, fuchsia, rose, emerald, amber, sky, teal, violet) replaced with zinc. Faint circuit-board background via `BackgroundGrid` SVG (24px dot grid + sparse trace pattern). Provider accent dots in the Compare panels became monospace 3-letter section codes (`LDC`, `MMR`, `LGV`, `LBR`, `DPL`, `LLM`, `THS`). Icons rebuilt monochrome.
- **Offline-first PWA** — hand-written `public/sw.js` (no Workbox). Shell uses stale-while-revalidate, navigations are network-first with `/` fallback, `/api/*` is network-only so we never serve stale translations. `ServiceWorkerRegister` component, prod-only, registers after window load.
- **Manifest polish** — grayscale theme color, `display_override: window-controls-overlay` so the future Tauri desktop window gets a clean title bar, PT added to description, maskable icon variant (`/icon-maskable.svg`) for Android safe-zones, launch shortcuts to Live and Compare modes.
- **Tauri 2 desktop scaffold** (`src-tauri/`) — Cargo manifest, `tauri.conf.json` configured for remote-URL mode (window loads the deployed Vercel app, zero web-app refactor), capabilities for the global-shortcut plugin, README with the first-time `rustup` + `cargo tauri icon` + `cargo tauri dev` setup. npm scripts: `tauri:dev`, `tauri:build`. Produces `.app` + `.dmg` on macOS and `.msi` + `.exe` on Windows.

### Forward vision

The repo is now structured so the **same web codebase** powers four targets:

| Target | Mechanism | Code shared | Status |
|---|---|---|---|
| Web (PWA) | Next.js 16 on Vercel + service worker | 100% | Live at translangai.vercel.app |
| Android (PWA) | Add to Home Screen, or future TWA wrapper for Play Store | 100% | A2HS works today |
| iOS (PWA) | Add to Home Screen via Share sheet | 100% | A2HS works today |
| macOS | Tauri 2 native shell loads the web URL | ~95% (Rust shell only) | Scaffolded, untested |
| Windows | Tauri 2 native shell loads the web URL | ~95% (Rust shell only) | Scaffolded, untested |

Each platform inherits new web features automatically — no per-platform release cycle for normal updates. Native-only features (global hotkey, macOS Services menu, system tray) will land in `src-tauri/src/lib.rs` and call back into the web app via Tauri's IPC.

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
