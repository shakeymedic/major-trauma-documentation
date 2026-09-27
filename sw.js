// Major Trauma Tool — Service Worker v3.4
// Network-first: every load fetches the latest files when online and only falls back to the cache offline.
// (The previous cache-first worker never re-fetched cached files, so installed users stayed on old versions.)
const CACHE_NAME = 'trauma-tool-v3.4';
const ASSETS = [
  './',
  './index.html',
  './script.js',
  './styles.css',
  './manifest.json'
];

// Install: pre-cache core assets for offline use
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS.map(a => new Request(a, { cache: 'reload' }))))
  );
  self.skipWaiting();
});

// Activate: delete old caches (including the stale v2.7 cache) and take control immediately
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch: network-first for same-origin GET requests, falling back to the cache when offline
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if(e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(response => {
      if(response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      }
      return response;
    }).catch(() =>
      caches.match(e.request).then(cached => cached || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
    )
  );
});
