// network-first: always show the newest posts; fall back to cache offline
const C = 'hub-v1';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok && !/\.enc\.json/.test(u.pathname)) { const c = r.clone(); caches.open(C).then(x => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request)));
});
