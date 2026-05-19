const CACHE_NAME = 'salem-v21';
const ASSETS = ['/', '/index.html', '/styles.css', '/app.js', '/manifest.json', '/channels.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.map(k => k !== CACHE_NAME ? caches.delete(k) : undefined)
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isJson = url.pathname.endsWith('.json');

  if (isJson) {
    e.respondWith(fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request)));
    return;
  }

  e.respondWith(caches.match(e.request).then(cached => {
    if (cached) return cached;
    return fetch(e.request).then(res => {
      if (!res || res.status !== 200) return res;
      const clone = res.clone();
      caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => e.request.mode === 'navigate' ? caches.match('/index.html') : undefined);
  }));
});
