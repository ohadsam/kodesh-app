const APP_VERSION = '5.28';
const CACHE = `kodesh-v${APP_VERSION}`;

// Only cache fonts – never JS/CSS/HTML (served fresh from network always)
const FONT_URLS = [
  'https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@300;400;500;700;900&family=Heebo:wght@300;400;500;700&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(FONT_URLS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      console.log('[SW] v' + APP_VERSION + ' activating, clearing:', keys);
      return Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Fonts: cache-first
  if (url.includes('fonts.g')) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
    return;
  }

  // JS / CSS / HTML app files: NETWORK-FIRST, no caching
  // This ensures every deploy immediately reaches users
  if (url.includes(self.location.origin) &&
      (url.endsWith('.js') || url.endsWith('.css') || url.endsWith('.html') || url.endsWith('/'))) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Sefaria / Hebcal API: network-first, cache as fallback
  if (url.includes('sefaria.org') || url.includes('hebcal.com')) {
    e.respondWith(
      fetch(e.request).then(r => {
        const clone = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Everything else: network-first
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
