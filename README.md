# TransLang AI

Any-to-any dictionary & translator for **English · Russian · Danish · German**, with **multiple sources side-by-side**. Mobile-first web app, idiom-aware, with a clean path to **native macOS** (global hotkey + system-wide right-click translation) via Tauri.

See **[DESIGN.md](./DESIGN.md)** for the full design spec.

---

## Quick start

```bash
npm install
cp .env.local.example .env.local   # optional — app runs without keys
npm run dev
```

Open <http://localhost:3000>.

**No API keys?** It still works — each provider gracefully falls back to a small offline seed dictionary and clearly labels itself as such. Add keys to `.env.local` whenever you want the real thing.

---

## What's in v0.1 (MVP)

- One input → **four parallel result panels** (each pickable per slot).
- Default providers: **DeepL**, **Local dictionary**, **LLM (idiom-aware)**, **Thesaurus & context**.
- Any-to-any **EN / RU / DA / DE** (12 directed pairs).
- Idiom detection — figures of speech map to *local equivalents*, not literal translations.
- Mobile-first responsive layout (1 col → 2×2 → 4 col).
- Language pair + panel layout persist in `localStorage`.
- Light/dark mode follows OS.

## What's next

- Auto language detection (`fast-langdetect`, client-side).
- IndexedDB cache, history & pinned favorites.
- More providers: Reverso, Linguee, Wiktionary, InfoDanish, Duden, Gramota, macOS Dictionary.
- **Native macOS via Tauri**: global hotkey `⌘⇧D`, macOS Services "Translate Selection" so right-click works anywhere.

## Architecture (1-line)

`UI → /api/translate?providerId=… → TranslationProvider plugin → result`. Every backend implements the same `TranslationProvider` interface — adding a new source is one file.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind v4 · React 19 · planned: better-sqlite3, idb, Anthropic SDK, Tauri 2.
