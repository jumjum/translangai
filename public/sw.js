// TransLang AI — offline-first service worker.
// Tiny, hand-written. No build step, no Workbox.
//
// Strategy:
//   • Navigation requests → network, fall back to cached "/" shell.
//   • Same-origin static (HTML/JS/CSS/SVG/font) → stale-while-revalidate.
//   • /api/* → network-only (translation results are dynamic, the server
//     keeps its own LRU; we don't want to serve stale translations).
//
// Bump CACHE_NAME to force a refresh of the precache list.

const CACHE_NAME = "translangai-v1";
const PRECACHE = ["/", "/manifest.webmanifest", "/icon.svg", "/icon-maskable.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((c) => c.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // API: always network. Don't poison cache with translations.
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: network-first, fall back to "/" shell.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/").then((r) => r ?? Response.error())),
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached ?? network;
    }),
  );
});
