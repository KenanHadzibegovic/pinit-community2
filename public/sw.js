/* PINIT Zajednica — service worker.
   Ljuska se kesira da aplikacija radi i kad je veza slaba.
   API pozivi NIKAD se ne kesiraju (podaci moraju biti svjezi). */
const CACHE = 'pinit-zajednica-v1';
const SHELL = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // API — uvijek sa mreze, nikad iz kesa
  if (url.pathname.startsWith('/api/')) return;
  // strane adrese (karte, fontovi) — pusti browseru
  if (url.origin !== location.origin) return;

  // otvaranje aplikacije: mreza pa kes
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put('/', copy)).catch(() => {});
        return r;
      }).catch(() => caches.match('/'))
    );
    return;
  }

  // ostalo: kes pa mreza
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok) {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return r;
    }))
  );
});
