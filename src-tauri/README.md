# TransLang AI — desktop shell (Tauri 2)

This folder wraps the live web app at https://translangai.vercel.app/ into a
native macOS / Windows / Linux binary. **No web-app refactor required**: the
Tauri window loads the same Next.js app you already run on Vercel.

## First-time setup (one-off)

```bash
# 1. Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. Tauri CLI
cargo install tauri-cli --version "^2.0"

# 3. Generate platform icons from the project SVG
cd src-tauri
cargo tauri icon ../public/icon.svg
```

## Dev

From the repo root:

```bash
npm run tauri:dev    # opens a native window pointing at http://localhost:3000
```

The first build is slow (~3–5 min — Rust compiles a lot of crates). Subsequent
builds are fast.

## Production build

```bash
npm run tauri:build
```

Outputs to `src-tauri/target/release/bundle/`:

- macOS: `dmg/TransLang AI_0.7.0_aarch64.dmg`, `macos/TransLang AI.app`
- Windows: `msi/TransLang AI_0.7.0_x64_en-US.msi`, `nsis/TransLang AI_0.7.0_x64-setup.exe`

## What you get on top of the web app

- Native window with native title bar (macOS) / Windows chrome
- Add a global hotkey via the `global-shortcut` plugin (already wired,
  registration code TBD in `src/lib.rs`)
- App appears in macOS dock, Windows Start menu, Spotlight
- Auto-loads the latest deploy on every launch (no app-store update cycle)
- Can later add: system tray, "Translate Selection" macOS Service, deep links

## Why "remote URL" mode?

The web app has server-side API routes (`/api/translate`, `/api/summarize`) that
need a Node.js runtime. We don't want to package a Node server into a desktop
binary just for these. By loading the deployed Vercel URL, the desktop app
keeps using the same backend infrastructure — and gets auto-updates for free.
