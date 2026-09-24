// Service worker: fa funzionare l'app senza rete.
//
// IMPORTANTE — quando modifichi index.html, app.js, cycle.js o lo stile,
// cambia il numero qui sotto (1 -> 2 -> 3 ...). È il segnale che dice a iOS
// di scaricare la versione nuova invece di riusare quella in cache.
const CACHE = 'ciclo-v9';

const ASSETS = [
  './',
  './index.html',
  './app.js',
  './cycle.js',
  './strings.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first: la copia locale risponde subito, poi si aggiorna in silenzio.
// Così l'app parte anche in aereo o senza campo.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then((hit) => {
      const net = fetch(e.request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
