const APP_VERSION = '4.2';
const CACHE = `kodesh-v${APP_VERSION}`;
const STATIC = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './js/utils.js',
  './js/settings.js',
  './js/app.js',
  './js/tehilim.js',
  './js/calendar.js',
  './js/content.js',
  './js/tefilot.js',
  './js/siddur.js',
  './js/misc.js',
  './js/init.js',
  'https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@300;400;500;700;900&family=Heebo:wght@300;400;500;700&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      console.log('[SW] v' + APP_VERSION + ' activating, clearing old caches:', keys);
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
  // API calls (Sefaria, Hebcal): network-first, fallback to cache
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
  // Static assets: cache-first
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
