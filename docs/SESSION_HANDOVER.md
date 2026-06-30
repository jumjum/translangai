# TransLang AI — Session Handover

> Single document a new session should read first to know where this project stands.
> Keep this terse and **decision-focused** — git log is the audit trail, DESIGN.md is the long-form spec.

**Last updated**: end of v0.12.1 session
**Loaded version**: `v0.12.1` (commit `27d28ae`)
**Production**: `v0.12.1` (https://translangai.vercel.app/api/version confirms)
**Tests**: 43/43 pass · typecheck clean · production build clean · working tree clean

---

## Where we are right now

A working, deployed, mobile-first PWA omni-translator. EN · RU · DA · DE · SV · PT · PL · ES. Three live views (Split / Pairs / Stream) plus a Transcription mode (when src=tgt). Web Speech for ASR + TTS. Server-side LRU cache. Free-by-default provider chain (Local · MyMemory · Lingva · LibreTranslate); paid LLM polish/translate/summary as opt-in.

What's *deployed and reachable* on translangai.vercel.app today:

- 3 layouts + transcription pane, chat-paradigm bottom composer.
- Eight languages, frequency-sorted two-column language picker.
- File-text drop into source.
- Polyglot voice-pick for language pair (two-attempt ASR ladder).
- 2-minute auto-save sessions in History sidebar (left-edge swipe on mobile).
- R&D drawer (bottom-right) with: console links, **build-sync indicator**, ASR diagnostic, polish settings, usage dashboard, polish/Gemini/Claude-Haiku/Groq provider chooser.
- `/api/version` for drift detection.

What's specced but **not** built (DESIGN sections in parens):

- §16 universal input — audio/image/URL drop (text-only today).
- §22 Whisper-based ASR fallback for poor browser-ASR languages (Swedish).
- §23 Multi-user "linked phones" via WebRTC.
- §24 Vertical / on-prem builds (medical, police, insurance).
- §25 Camera OCR (Tesseract.js).
- §26 Tauri desktop builds + Android TWA.

---

## ⚠ Action items the user needs to do (only the user can)

1. **Set Vercel env vars** — polish API currently reports `keys: { gemini:false, claude-haiku:false, groq:false }`. Until at least one is set in https://vercel.com/kimo400-gmailcoms-projects/polyglot/settings/environment-variables, the ✨ polish button in Transcribe mode falls back to "no key" and the usage dashboard stays empty. Recommended: `GEMINI_API_KEY` (cheapest; ~$0.0001 per polish).
2. **Verify deployment protection is off** — if R&D drawer still shows the SSO wall when external testers visit, flip Deployment Protection off in the same project settings.

Neither of these requires code changes from me.

---

## File / module map (one-line per file)

```
src/app/
  layout.tsx                          App shell, theme color, service-worker mount
  page.tsx                            Root — top-level state (lang pair, free mode, mode toggle)
  api/translate/route.ts              POST { providerId, q, src, tgt, freeMode } → cached result
  api/summarize/route.ts              POST { text, lang } → Claude or extractive summary
  api/polish/route.ts                 POST { text, lang, provider } → LLM-cleaned transcript
  api/version/route.ts                GET → { version, sha, branch, serverTimeMs }
  icon.tsx / apple-icon.tsx           Dynamic favicons (Culture-glyph)

src/components/
  LiveTranslator.tsx                  THE BIG ONE — orchestrates Split / Pairs / Stream / Transcribe.
                                      Owns speech, translation, summary, polish, history-save.
  CompareView.tsx                     Compare mode (4 provider panels side-by-side)
  ChatComposer.tsx                    Bottom chat-paradigm bar — textarea / live transcript / mic
  HistoryPanel.tsx                    Fly-in left history sidebar
  LanguageBar.tsx                     Combined two-column src/tgt picker with frequency sort + voice mic
  ResultPanel.tsx                     One Compare slot
  VoiceControl.tsx                    Merged speaker + voice-picker chip
  EdgeSwipeListener.tsx               Left-edge swipe → open history (mobile)
  DevBadge.tsx                        NODE_ENV-gated numbered overlays
  DevLinksDrawer.tsx                  Bottom-right ▸ R&D drawer (links + AdminPanel embedded at top)
  AdminPanel.tsx                      Build sync / ASR diagnostic / Polish settings / Usage dashboard
  BackgroundGrid.tsx                  Subtle circuit-board pattern behind everything
  ServiceWorkerRegister.tsx           Registers /sw.js for PWA offline shell

src/lib/
  types.ts                            LANGS, LANG_META (BCP-47 + flag + native + TTS code)
  ui.ts                               BTN_HERO / BTN_CHIP / BTN_CHIP_ACTIVE recipes
  i18n.ts                             6 placeholder strings × 8 langs (in-field localization)
  langNames.ts                        Alias table for "Swedish" / "ryska" / "англ." etc.
  langPairStats.ts                    Frequency-sort of language picker (localStorage)
  history.ts                          2-min auto-save sessions (localStorage)
  settings.ts                         Polish on/off, provider, auto-on-commit
  usage.ts                            Token/cost tracking per call (localStorage)
  version.ts                          APP_VERSION + BUILD_SHA + BRANCH baked into bundle
  drop.ts                             File-drop text extraction
  segmenter.ts                        Sentence/paragraph splitting + sticky-bottom + auto-grow textarea hooks
  speech.ts                           useSpeechRecognition + speak() + listVoicesForLang
                                      (anti-echo: pause-during-TTS, restart-delay, dedup, Chrome-Android incremental-final fix)
  cache.ts                            LRU cache (500 entries, 24h TTL)
  useClickAway.ts                     Close-on-outside-click hook (Radix-style)
  data/seed.ts                        ~110-entry × 8-lang ROWS dict + seedLookup / seedLookupPhrase
  providers/
    index.ts                          PROVIDERS registry, FREE_PROVIDERS / PAID_PROVIDERS partition
    types.ts                          TranslationProvider interface
    local.ts                          Bundled seed dict + tokenized fallback
    mymemory.ts                       Free MT (~1k words/day anon)
    lingva.ts                         Free Google proxy (multi-instance failover)
    libre.ts                          LibreTranslate (self-hostable)
    deepl.ts                          DeepL (key required) — graceful fallback to seed if no key
    llm.ts                            Claude idiom-aware (key required)
    thesaurus.ts                      LLM-backed thesaurus
    polish.ts                         Gemini Flash / Claude Haiku / Groq Llama polish endpoint backends

src/lib/__tests__/                    5 Vitest files, 43 cases
```

---

## What's planned + scope estimates (against findings)

In recommended order. **Bold = highest user-value-per-week.**

1. **Set Gemini key in Vercel** (user, 5 min) — unlocks the v0.12.0 polish feature that's already shipped but inert.
2. **Whisper fallback for Swedish ASR** (~3 days, DESIGN §22) — biggest quality bump for languages where browser ASR is weak. Same `/api/polish` pattern: POST `{ audioBlob, lang }` → text. Browser-recorded audio chunk goes to Groq's free Whisper-large-v3 endpoint (no cost, ~5s latency). Toggle in R&D drawer.
3. **Android TWA wrap** (~1 day, DESIGN §26) — Bubblewrap the existing PWA into a Play Store APK. Same code, real store presence. $25 one-time Google fee.
4. **Audio-file drop + Whisper transcription** (~2 days, DESIGN §16) — accept `.mp3/.wav/.m4a/.opus` via the existing drop zone, route to Whisper, populate source. Same pattern + endpoint as #2.
5. **Camera OCR via Tesseract.js** (~2 days, DESIGN §25) — accept image drop, OCR → source field. Pure in-browser, no API cost. Closes the biggest gap vs. Google Translate.
6. **Tauri desktop binaries** (~half-day, DESIGN §26 step 3) — `cargo tauri build` on the existing scaffold. Gives `.dmg` + `.msi` for demos. Global hotkey ⌘⇧D wiring after.
7. **Multi-user "linked phones"** (~1–2 weeks, DESIGN §23) — WebRTC DataChannel + QR pairing for two-phone conversation mode. Big differentiator, no competitor has it cleanly.
8. **Vertical / on-prem refactor** (~5–6 weeks, DESIGN §24) — pnpm monorepo + `packages/core` + `packages/ui` + medical pilot app + Docker bundle. **Do NOT start until a paying pilot exists.** Code is already mostly modular-ready.

Deferred / undecided:
- Polish "auto-on-commit" toggle is wired in settings but not yet connected to the Pairs commit pipeline (~5 lines if you want it).
- "Per-user" stats in dashboard are per-device today (no auth). When DESIGN §18 Pro tier ships, mirror to server.
- Polish button only in Transcribe mode for now — easy to add to Pairs/Stream.

---

## Memorable design constraints (don't violate without discussion)

- **Mobile thumb-zone**: input + primary buttons at the bottom. Output at the top.
- **Free by default**: green chip in the header gates paid providers at the server, not just the client.
- **No vendor lock**: every provider sits behind the `TranslationProvider` interface. Swappable.
- **R&D drawer = developer console**: dev-time UI, but ships in prod (no business reason to hide it; users see "R&D" and ignore it).
- **DevBadges**: numbered overlays, NODE_ENV-gated, hidden in prod.
- **Stealth on public surface**: this repo is public (`jumjum/translangai`) — no qwidd / gate / moat / vector / worker references.
- **Explicit git adds only**: no `git add -A` / `.` / `-a`. Fleet rule.
- **Napps drop files**: `NAPPS_DEV_PORTS.md` etc. are now in `.gitignore` — leave alone.

---

## Quick "next session, do this" if you only have one hour

1. Read this doc.
2. `curl https://translangai.vercel.app/api/version` — confirm prod is what `package.json` says.
3. Open the prod R&D drawer → check the **Build** section says ✓ in sync.
4. If polish provider keys still show `false`, ping the user to set `GEMINI_API_KEY` in Vercel.
5. Pick item #2 above (Whisper fallback) — biggest user-visible win. Specced in DESIGN §22, mirrors `/api/polish` shape.
