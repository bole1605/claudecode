const CACHE = 'kasse-v4';
const ASSETS = ['./', 'index.html', 'styles.css?v=4', 'app.js?v=4', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
// Alles am HTTP-Cache vorbei laden, sonst landet eine veraltete Version (GitHub Pages: max-age 10 min) im Cache
self.addEventListener('install', e => e.waitUntil(
  caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => fetch(a, { cache: 'reload' }).then(r => c.put(a, r))))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())));
// Netzwerk zuerst (ohne HTTP-Cache), Cache nur als Offline-Fallback
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache: 'no-store' }).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)).catch(() => {}); return r; }).catch(() => caches.match(e.request)));
});
