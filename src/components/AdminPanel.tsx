"use client";

import { useEffect, useState } from "react";
import { useSettings, type PolishProviderId } from "@/lib/settings";
import { clearUsage, summariseUsage, useUsage } from "@/lib/usage";
import { APP_VERSION, BUILD_BRANCH, BUILD_SHA } from "@/lib/version";
import { isSpeechRecognitionSupported } from "@/lib/speech";
import { LANG_META } from "@/lib/types";

/**
 * R&D-tab admin panel. Two sections:
 *   1. Settings — polish on/off, auto-on-commit, provider chooser.
 *   2. Usage dashboard — calls / tokens / cost, broken down by provider
 *      and endpoint. Client-side only (localStorage).
 *
 * Designed to be embedded in the existing DevLinksDrawer popover.
 */
export default function AdminPanel() {
  const [settings, setSettings] = useSettings();
  const usage = useUsage();
  const stats = summariseUsage(usage);
  const [keys, setKeys] = useState<{ gemini: boolean; "claude-haiku": boolean; groq: boolean } | null>(null);

  // Version probe — server reports its own APP_VERSION; we compare to the
  // one baked into THIS bundle. Divergence = the loaded page is stale
  // (CDN / service-worker cache).
  const [server, setServer] = useState<{ version: string; sha: string; branch: string } | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);

  // ASR diagnostic — what language is the recogniser actually set to,
  // and is the API supported in this browser at all? Helps debug
  // "Swedish doesn't pick up any audio" type reports.
  const [asrLangs, setAsrLangs] = useState<string[] | null>(null);

  useEffect(() => {
    fetch("/api/polish", { method: "GET" })
      .then((r) => r.json())
      .then((d) => setKeys(d.keys ?? null))
      .catch(() => {});

    fetch("/api/version", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setServer({ version: d.version, sha: d.sha, branch: d.branch }))
      .catch((e) => setVersionError(String(e)));

    // What language tags can the browser recogniser advertise? We can't
    // ask for the supported list directly, but we can echo what we'd
    // pass and let the user verify it matches the OS-installed pack.
    setAsrLangs(
      Object.values(LANG_META)
        .map((m) => m.bcp47)
        .sort(),
    );
  }, []);

  const inSync = server && server.version === APP_VERSION && (!server.sha || !BUILD_SHA || server.sha === BUILD_SHA);
  const asrOk = isSpeechRecognitionSupported();

  const fmtUsd = (n: number) =>
    n < 0.01 ? `$${n.toFixed(4)}` : n < 1 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`;
  const fmtNum = (n: number) => n.toLocaleString();

  const providerLabels: Record<PolishProviderId, string> = {
    gemini: "Gemini 2.0 Flash · $0.0001/polish",
    "claude-haiku": "Claude Haiku 4.5 · $0.0008/polish",
    groq: "Groq Llama 3.1 8b · free",
  };

  return (
    <div className="text-[12px]">
      {/* ── Build / version probe ────────────────────────────────────── */}
      <section className="px-3 py-2">
        <p className="system-label mb-1.5 text-zinc-500 dark:text-zinc-400">Build</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 tabular-nums">
          <dt className="text-zinc-500">Loaded bundle</dt>
          <dd className="text-right font-mono">
            v{APP_VERSION}
            {BUILD_SHA ? <span className="text-zinc-400"> · {BUILD_SHA}</span> : null}
            {BUILD_BRANCH ? <span className="text-zinc-400"> · {BUILD_BRANCH}</span> : null}
          </dd>
          <dt className="text-zinc-500">Server reports</dt>
          <dd className="text-right font-mono">
            {versionError
              ? <span className="text-zinc-400">unreachable</span>
              : server
                ? <>v{server.version}{server.sha ? <span className="text-zinc-400"> · {server.sha}</span> : null}</>
                : <span className="text-zinc-400">…</span>}
          </dd>
          <dt className="text-zinc-500">Sync</dt>
          <dd className="text-right">
            {!server ? (
              <span className="text-zinc-400">checking…</span>
            ) : inSync ? (
              <span className="text-zinc-700 dark:text-zinc-200">✓ in sync</span>
            ) : (
              <button
                type="button"
                onClick={() => location.reload()}
                className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                title="Your loaded bundle is older than what the server is serving. Click to hard-reload."
              >
                ⚠ behind · reload
              </button>
            )}
          </dd>
        </dl>
      </section>

      {/* ── ASR diagnostic ───────────────────────────────────────────── */}
      <section className="border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <p className="system-label mb-1.5 text-zinc-500 dark:text-zinc-400">Speech recognition</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-zinc-500">API supported</dt>
          <dd className={`text-right font-mono ${asrOk ? "" : "text-zinc-400"}`}>
            {asrOk ? "✓ Web Speech available" : "× not supported in this browser"}
          </dd>
          <dt className="text-zinc-500">Will request</dt>
          <dd className="text-right font-mono text-zinc-400">
            {asrLangs?.join(" · ") ?? "…"}
          </dd>
        </dl>
        <p className="mt-1.5 text-[10.5px] leading-snug text-zinc-500 dark:text-zinc-400">
          Chrome on Android delegates to Google's recogniser; quality varies wildly per language.
          Swedish often needs a working data connection AND the system "Speech recognition" pack
          installed (Android: Settings → System → Languages → Speech recognition).
          On macOS, Chrome uses Google's cloud recogniser — no install needed.
        </p>
      </section>

      {/* ── Settings ──────────────────────────────────────────────────── */}
      <section className="border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <p className="system-label mb-1.5 text-zinc-500 dark:text-zinc-400">Polish (§22)</p>
        <label className="flex items-center justify-between gap-2 py-1">
          <span>Polish enabled</span>
          <input
            type="checkbox"
            checked={settings.polishEnabled}
            onChange={(e) => setSettings({ polishEnabled: e.target.checked })}
            className="accent-zinc-900 dark:accent-zinc-100"
          />
        </label>
        <label className="flex items-center justify-between gap-2 py-1">
          <span>Auto-polish on commit</span>
          <input
            type="checkbox"
            checked={settings.polishAutoOnCommit}
            disabled={!settings.polishEnabled}
            onChange={(e) => setSettings({ polishAutoOnCommit: e.target.checked })}
            className="accent-zinc-900 dark:accent-zinc-100 disabled:opacity-40"
          />
        </label>
        <div className="flex items-center justify-between gap-2 py-1">
          <span>Provider</span>
          <select
            value={settings.polishProvider}
            disabled={!settings.polishEnabled}
            onChange={(e) => setSettings({ polishProvider: e.target.value as PolishProviderId })}
            className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-[11px] disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {(Object.keys(providerLabels) as PolishProviderId[]).map((p) => (
              <option key={p} value={p} disabled={keys ? keys[p] === false : false}>
                {providerLabels[p]}
                {keys && keys[p] === false ? " (no key)" : ""}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* ── Usage dashboard ──────────────────────────────────────────── */}
      <section className="border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="system-label text-zinc-500 dark:text-zinc-400">Usage · this device</p>
          {usage.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirm("Clear all local usage stats?")) clearUsage();
              }}
              className="text-[10px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              clear
            </button>
          )}
        </div>

        {usage.length === 0 ? (
          <p className="text-zinc-400">No calls yet. Trigger a polish to populate.</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 tabular-nums">
              <dt className="text-zinc-500">Calls</dt>
              <dd className="text-right">{fmtNum(stats.total.calls)}</dd>
              <dt className="text-zinc-500">Input tokens</dt>
              <dd className="text-right">{fmtNum(stats.total.inputTokens)}</dd>
              <dt className="text-zinc-500">Output tokens</dt>
              <dd className="text-right">{fmtNum(stats.total.outputTokens)}</dd>
              <dt className="text-zinc-500">Words processed</dt>
              <dd className="text-right">{fmtNum(stats.total.words)}</dd>
              <dt className="text-zinc-500">Avg latency</dt>
              <dd className="text-right">
                {stats.total.calls ? Math.round(stats.total.latencyMs / stats.total.calls) : 0} ms
              </dd>
              <dt className="text-zinc-500">Cost total</dt>
              <dd className="text-right font-medium">{fmtUsd(stats.total.costUsd)}</dd>
              <dt className="text-zinc-500">Cost last 24h</dt>
              <dd className="text-right">{fmtUsd(stats.last24hCostUsd)}</dd>
            </dl>

            {/* By provider */}
            <p className="system-label mt-2 mb-1 text-zinc-500 dark:text-zinc-400">By provider</p>
            <ul className="space-y-0.5">
              {Object.entries(stats.byProvider).map(([p, s]) => (
                <li key={p} className="flex items-center justify-between tabular-nums">
                  <span className="truncate text-zinc-700 dark:text-zinc-300">{p}</span>
                  <span className="text-zinc-500">
                    {fmtNum(s.calls)} · {fmtUsd(s.costUsd)}
                  </span>
                </li>
              ))}
            </ul>

            {/* Cost projection */}
            <p className="system-label mt-2 mb-1 text-zinc-500 dark:text-zinc-400">
              Projection (linear extrapolation)
            </p>
            <ul className="space-y-0.5 tabular-nums text-zinc-600 dark:text-zinc-400">
              <li className="flex items-center justify-between">
                <span>Monthly at 24h pace</span>
                <span>{fmtUsd(stats.last24hCostUsd * 30)}</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Yearly at 24h pace</span>
                <span>{fmtUsd(stats.last24hCostUsd * 365)}</span>
              </li>
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
