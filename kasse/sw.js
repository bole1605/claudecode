// Service Worker: Offline-Betrieb. Netzwerk zuerst (am HTTP-Cache vorbei), der Cache dient nur als Rückfall.
const V = '37';
const SCOPE = new URL(self.registration.scope).pathname.replace(/\W+/g, '_');   // Test- und Live-Version bekommen getrennte Caches
const PREFIX = 'kasse' + SCOPE + '-';
const CACHE = PREFIX + 'v' + V;
const ASSETS = ['./', 'index.html', 'styles.css?v=37', 'logic.js?v=37', 'qrcode.js?v=37', 'app.js?v=37', 'manifest.webmanifest', 'bon.html', 'display.html', 'sound.js', 'sound.js?v=37', 'theme.js', 'theme.js?v=37', 'logic.js', 'icons/jugend-hell.png', 'icons/jugend-dunkel.png',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => e.waitUntil(
  caches.open(CACHE)
    .then(c => Promise.all(ASSETS.map(a => fetch(a, { cache: 'reload' }).then(r => { if (!r.ok) throw new Error(a + ' ' + r.status); return c.put(a, r); }))))
    .then(() => self.skipWaiting())));

self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())));

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-store' })
      .then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)).catch(() => {}); } return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match(e.request, { ignoreSearch: true })).then(r => r || (e.request.mode === 'navigate' ? caches.match('index.html') : undefined))));
});
