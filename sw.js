// Offline cache for the installed (Home Screen) game. Network first, cache as fallback.
const CACHE = 'monkey-rampage-v1';
const FILES = ['./', 'index.html', 'style.css', 'manifest.json', 'js/main.js', 'js/city.js', 'js/monkey.js', 'js/actors.js', 'js/fx.js', 'js/util.js', 'vendor/three.module.min.js', 'icons/icon-192.png', 'icons/icon-180.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => { if (e.request.method !== 'GET') return; e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); return r; }).catch(() => caches.match(e.request))); });
