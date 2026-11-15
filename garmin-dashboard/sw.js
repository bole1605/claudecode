/* Service Worker: Netzwerk zuerst (immer aktuell), Cache als Offline-Fallback. Karten/Routing laufen direkt ohne SW. */
const CACHE = 'garmin-dashboard-v1';
const SHELL = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'js/core.js', 'js/charts.js', 'js/pages.js', 'js/route.js', 'js/main.js',
  'vendor/chart.umd.js', 'vendor/leaflet.js', 'vendor/leaflet.css', 'vendor/images/marker-icon.png', 'vendor/images/marker-icon-2x.png', 'vendor/images/marker-shadow.png',
  'vendor/images/layers.png', 'vendor/images/layers-2x.png', 'icons/icon.svg', 'icons/icon-192.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
