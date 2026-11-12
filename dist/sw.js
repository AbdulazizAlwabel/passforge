/* Nicely Done — offline cache */
const CACHE = 'nd-0ae0b4a221';
const PRECACHE = ["/", "/404.html", "/assets/site.css?v=0ae0b4a221", "/assets/site.js?v=0ae0b4a221", "/assets/fonts.css?v=0ae0b4a221", "/assets/strength.js?v=0ae0b4a221", "/assets/pdf-studio.css?v=0ae0b4a221", "/assets/fonts/funnel-display-normal-300-800-latin.woff2", "/assets/fonts/funnel-sans-normal-300-800-latin.woff2", "/assets/prism.js?v=0ae0b4a221", "/assets/prism-still.webp?v=0ae0b4a221", "/favicon.svg", "/password-generator/", "/strength-checker/", "/share/", "/link-checker/", "/email-checker/", "/vault/", "/hash-generator/", "/username-generator/", "/base64-tool/", "/json-formatter/", "/text-converter/", "/ip-network/", "/pdf-studio/", "/unit-converter/", "/speed-test/", "/date-converter/", "/qr-code/", "/image-resizer/", "/tools/", "/about/", "/privacy/", "/ar/", "/ar/404.html"];
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
