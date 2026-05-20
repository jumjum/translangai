/**
 * Tiny in-memory LRU cache.
 *
 * Sits in front of the provider layer to:
 *  - kill duplicate requests for the same (provider, src, tgt, q),
 *  - keep paid providers (DeepL / LLM) from being called twice for the same input,
 *  - survive across requests within the same Node process (Vercel function instance).
 *
 * Capped at MAX entries with simple LRU eviction. Entries expire after TTL_MS.
 */

type Entry<T> = { v: T; expires: number };

export class LruCache<T> {
  private map = new Map<string, Entry<T>>();
  constructor(private readonly max = 500, private readonly ttlMs = 24 * 60 * 60 * 1000) {}

  get(key: string): T | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (e.expires < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // Re-insert to mark as most recently used.
    this.map.delete(key);
    this.map.set(key, e);
    return e.v;
  }

  set(key: string, v: T): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { v, expires: Date.now() + this.ttlMs });
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  size() {
    return this.map.size;
  }

  clear() {
    this.map.clear();
  }
}

/** Process-wide translation cache (survives across requests). */
declare global {
  // eslint-disable-next-line no-var
  var __polyglot_cache: LruCache<unknown> | undefined;
}
export const translationCache: LruCache<unknown> =
  globalThis.__polyglot_cache ?? (globalThis.__polyglot_cache = new LruCache(500));
