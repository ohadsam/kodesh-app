const APP_VERSION = '5.68';
const CACHE = `kodesh-v${APP_VERSION}`;

const FONT_URLS = [
  'https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@300;400;500;700;900&family=Heebo:wght@300;400;500;700&display=swap'
];

self.addEventListener('install', e => {
  console.log('[SW] installing v' + APP_VERSION);
  // Install immediately — take over without waiting
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(FONT_URLS).catch(() => {}))
  );
});

self.addEventListener('activate', e => {
  console.log('[SW] activating v' + APP_VERSION + ' – clearing old caches');
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => {
          console.log('[SW] deleting cache:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())
  );
});

// Listen for SKIP_WAITING message from client
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // NEVER intercept reset.html — let it always go to network
  if (url.includes('reset.html')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Fonts: cache-first
  if (url.includes('fonts.g') || url.includes('fonts.gstatic')) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request))
    );
    return;
  }

  // App HTML/JS/CSS: NETWORK-FIRST, cache: no-store to bypass HTTP cache
  if (url.includes(self.location.origin)) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Sefaria / Hebcal: network-first with cache fallback
  if (url.includes('sefaria.org') || url.includes('hebcal.com')) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
