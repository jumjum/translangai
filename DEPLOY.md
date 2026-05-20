# Deploying Polyglot for free (and keeping it free)

This guide gets your friend's deploy live on a real https URL — required for the microphone — without spending money.

There are **three** moving parts:
1. **Hosting** the Next.js app.
2. **Translation providers** — what actually answers the queries.
3. **Cost-control switches** baked into the app.

---

## 1. Free hosting — pick one

| Option | Free tier | https? | Best for | Setup time |
|---|---|---|---|---|
| **Vercel** (recommended) | 100 GB bandwidth/mo, unlimited static, 1 GB serverless | ✅ auto | Next.js apps (zero config) | 2 min |
| Cloudflare Pages | 500 builds/mo, unlimited bandwidth | ✅ auto | Static + lightweight functions | 5 min |
| Netlify | 100 GB bandwidth/mo | ✅ auto | Drop-in alt to Vercel | 5 min |
| Self-host (Fly.io, Render) | Limited free | ✅ auto | If you outgrow Vercel's serverless | 10 min |

### Vercel — step by step

```bash
# Once, locally:
npm install -g vercel

cd /Users/hackerth/Projects/noname
vercel              # follow prompts: create new project, link to this dir
vercel --prod       # deploys to https://<name>.vercel.app
```

Or via the web UI:
1. Push this repo to GitHub: `gh repo create polyglot --public --source=. --push`
2. Go to <https://vercel.com/new> → "Import Git Repository" → pick `polyglot`.
3. Click **Deploy**. Vercel detects Next.js, no configuration needed.
4. Optional: add environment variables (next section) — *only if you want paid providers*.

You'll get an https URL like `https://polyglot-xyz.vercel.app`. That URL is what your friend opens on iPhone Safari or Android Chrome. The mic will work because Vercel gives you https.

---

## 2. Providers — three free, three optional paid

The app ships with **six** providers. The defaults are configured so the deploy is **fully free** unless you explicitly add keys.

### Free providers (no key, no cost)

| Provider | Where data comes from | Limits |
|---|---|---|
| **Local dictionary** | Bundled JSON seed (in repo) + (Phase 3) FreeDict / Wiktextract import | None — works offline |
| **MyMemory** | https://mymemory.translated.net | ~1,000 words/day anonymous |
| **LibreTranslate** | Public instance at https://libretranslate.de OR your own self-hosted | Public instance is rate-limited; self-host = unlimited |

To raise the **MyMemory** quota to ~10,000 words/day, set:
```
MYMEMORY_EMAIL=you@example.com
```
(No signup, just include an email — that's how their quota tier works.)

To run **your own LibreTranslate** for unlimited free translation:
```bash
docker run -d --name libretranslate -p 5000:5000 \
  libretranslate/libretranslate --load-only en,ru,da,de,sv
```
Then in your Vercel project settings → Environment Variables, add:
```
LIBRETRANSLATE_URL=https://your-libretranslate-host.example.com/translate
```
Free hosts for LibreTranslate: Fly.io free tier, Oracle Cloud Free Tier, a Raspberry Pi at home.

### Paid providers (need keys, blocked unless "Free mode" is OFF)

| Provider | Key env var | Pricing | When to use |
|---|---|---|---|
| **DeepL** | `DEEPL_API_KEY` (suffix `:fx` = free tier) | DeepL has a free tier: 500k chars/mo | Higher-quality DA/DE/RU/SV |
| **LLM** (Anthropic) | `ANTHROPIC_API_KEY` | Pay-per-token | Idiom-aware translation, figures of speech |
| **Thesaurus** | reuses `ANTHROPIC_API_KEY` | Pay-per-token | Synonyms, register |

Add these to Vercel project → Settings → Environment Variables. They are read by the API route only (never shipped to the browser).

---

## 3. Cost-control switches (already wired)

The app has four layers of cost protection:

1. **"Free mode" ON by default** — the green chip in the header. While ON, the *server* gates paid providers and returns a friendly "Free mode is on" note. Even a buggy client can't bill you.
2. **LRU cache** — every translation result is cached server-side for 24h (500-entry LRU). Repeated lookups for "hello" are free after the first one.
3. **Free-first chain in Live mode** — the cascade is `mymemory → libre → local` (with `llm` prepended only when paid is enabled).
4. **Graceful no-key fallback** — paid providers without keys return a "no key set" notice instead of erroring. The UI shows a small *fallback* badge.

If you don't add a single paid key, **the deploy costs $0 forever** (within free-tier bandwidth limits).

---

## 4. Free-quota math

A reasonable daily-use scenario for one user:

- ~50 unique translations per day → most cached after a week → ~10 cache-misses/day.
- Average phrase ~6 words → ~60 MyMemory words/day used.
- Headroom on 1,000 words/day quota: **>90 %**.

For 10 users sharing one deploy with `MYMEMORY_EMAIL` set (~10k words/day), you have ~16× safety factor.

If you blow past it: spin up self-hosted LibreTranslate (see above) and set `LIBRETRANSLATE_URL`. That removes the quota entirely.

---

## 5. Testing on a real phone

### Android Chrome
1. Open the Vercel URL.
2. Tap mic → "Allow" microphone permission.
3. Speak in the chosen source language.

### iPhone Safari
1. Open the Vercel URL in Safari (not Chrome on iOS — uses WebKit but mic permission is flakier).
2. *Settings → General → Keyboard → Enable Dictation* must be ON.
3. Tap mic → "Allow" microphone permission (first time only).
4. Optional: Share sheet → **Add to Home Screen** → you get the brand icon + a standalone PWA window.

### Verify locally before deploy
```bash
npm run typecheck    # ts strict pass
npm test             # 25 vitest tests
npm run build        # production build
npm start            # serve on http://localhost:3000
```

For mic-on-localhost testing you can use Chrome desktop — `http://localhost` is treated as a secure context.

---

## 6. Importing real local dictionaries (later — for true offline)

Once deployed, you can replace the small seed JSON with a real bilingual corpus:

- **FreeDict** — <https://freedict.org/downloads/> — TEI XML dumps for EN ↔ DA / DE / RU / SV. Convert with `freedict-tools` or `dictd2json`.
- **Wiktextract** — <https://kaikki.org> — Wiktionary entries with translations, IPA, examples. Per-language JSON dumps (~hundreds of MB).
- **Tatoeba** — <https://tatoeba.org/en/downloads> — Aligned example sentences. CC-BY-2.0-FR.

Plan:
1. Download the dump.
2. Filter to your language pair → import into `better-sqlite3`.
3. Replace `seedLookup()` with a SQLite query in `src/lib/providers/local.ts`.

That gives you **unlimited free translation for the words and phrases the dictionary covers**, no MyMemory quota touched.

---

## 7. TL;DR cheat sheet

```bash
# Deploy
git init && git add . && git commit -m "init"
gh repo create polyglot --public --source=. --push
# → https://vercel.com/new → import → Deploy
# Done. Free. https://polyglot-<hash>.vercel.app

# Optional: bump MyMemory quota for free
# In Vercel env vars: MYMEMORY_EMAIL=you@example.com

# Optional: zero-quota LibreTranslate
# On Fly.io / your VPS:
docker run -d -p 5000:5000 libretranslate/libretranslate \
  --load-only en,ru,da,de,sv
# In Vercel env vars: LIBRETRANSLATE_URL=https://yourhost/translate

# Optional: turn on paid power
# In Vercel env vars:
#   DEEPL_API_KEY=...:fx
#   ANTHROPIC_API_KEY=sk-ant-...
# Then flip the "free mode" chip OFF in the UI to use them.
```

That's the whole deployment story.
