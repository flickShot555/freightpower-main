/* Simple service worker for offline-friendly SPA behavior.
 * Note: This is intentionally minimal (no Workbox). For production-grade caching,
 * consider using a Vite PWA plugin or Workbox build step.
 */

const CACHE_NAME = 'freightpower-pwa-v1';

// Core files to keep available offline.
// Vite's hashed assets are not known here without a build step, so we focus on
// index + manifest + icons. Runtime caching handles same-origin requests.
const PRECACHE_URLS = [
  
  '/admin/dashboard',
  '/super-admin/dashboard',
  '/index.html',
  '/manifest.json',
  '/icons/FP-logo-removebg-preview.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin requests.
  if (url.origin !== self.location.origin) return;

  // SPA navigation fallback.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const network = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put('/index.html', network.clone());
          return network;
        } catch (_) {
          const cached = await caches.match('/index.html');
          return cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        }
      })()
    );
    return;
  }

  // Cache-first for static-ish same-origin files.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // Cache successful GET responses.
          if (req.method === 'GET' && res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
