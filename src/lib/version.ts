// Single source of truth for the version constant baked into every
// JS bundle. Read at module-load time from package.json via Next's
// build-time inlining of imports, falling back to the env var that
// Vercel exposes (VERCEL_GIT_COMMIT_SHA) for a short commit pin.
//
// Why: the user reported confusion about whether prod was in sync with
// dev. The R&D drawer shows BOTH — the version inside the current
// bundle (what you're looking at right now) AND whatever /api/version
// reports (what the server thinks it is). If the two diverge after a
// deploy, your browser is on a stale cache.

import pkg from "../../package.json" with { type: "json" };

export const APP_VERSION: string = pkg.version;

// Vercel injects these at build time. We only ship the short SHA — the
// repo is public but no reason to ship the full commit hash.
export const BUILD_SHA: string =
  (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    "")
    .slice(0, 7);

export const BUILD_BRANCH: string =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF ??
  process.env.VERCEL_GIT_COMMIT_REF ??
  "";
