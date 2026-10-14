/* Nicely Done — offline cache */
const CACHE = 'nd-15fb6b1b3c';
const PRECACHE = ["/", "/404.html", "/assets/site.css?v=15fb6b1b3c", "/assets/site.js?v=15fb6b1b3c", "/assets/fonts.css?v=15fb6b1b3c", "/assets/fonts/geist-normal-300-700-latin.woff2", "/assets/fonts/instrument-serif-normal-400-latin.woff2", "/favicon.svg", "/password-generator/", "/strength-checker/", "/share/", "/hash-generator/", "/username-generator/", "/base64-tool/", "/json-formatter/", "/text-converter/", "/ip-network/", "/unit-converter/", "/speed-test/", "/date-converter/", "/about/", "/ar/", "/ar/404.html"];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  if (!sameOrigin) return;
  if (sameOrigin && url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match(url.pathname.startsWith('/ar/') ? '/ar/404.html' : '/404.html'))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});
