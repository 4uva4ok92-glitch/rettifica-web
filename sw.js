const CACHE = 'rettifica-web-0.7.2-1';
const ASSETS = ["./", "./ai.js", "./app.js", "./apple-touch-icon.png", "./calc.js", "./fonts/OFL.txt", "./fonts/barlow-400.woff2", "./fonts/barlow-600.woff2", "./fonts/barlow-700.woff2", "./fonts/barlow-800.woff2", "./fonts/barlow-cond-600.woff2", "./fonts/barlow-cond-700.woff2", "./fonts/plex-mono-400.woff2", "./fonts/plex-mono-600.woff2", "./guide/g-lavori.jpg", "./guide/g-newjob.jpg", "./guide/g-result.jpg", "./icon-192.png", "./icon-512.png", "./index.html", "./manifest.webmanifest", "./ocr-parse.js", "./web.js"];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x.startsWith('rettifica-web-') && x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return; // AI calls go straight to the network
  if (r.mode === 'navigate') { e.respondWith(fetch(r).then((res) => { const c = res.clone(); caches.open(CACHE).then((x) => x.put('./index.html', c)); return res; }).catch(() => caches.match('./index.html'))); return; }
  e.respondWith(caches.match(r, { ignoreSearch: true }).then((hit) => hit || fetch(r).then((res) => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then((x) => x.put(r, c)); } return res; })));
});
