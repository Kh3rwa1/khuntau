// Khuntau service worker: keeps the game on the phone so solo play works offline, and sends the daily reminder.
// The page itself is always fetched fresh when there is a connection, so updates show at once.
const VERSION = '8d3aec841d';
const CACHE = 'khuntau-' + VERSION;
const FILES = [ "/audio/bellow.mp3", "/audio/bells.mp3", "/audio/bonk.mp3", "/audio/cheer1.mp3", "/audio/cheer2.mp3", "/audio/clap.mp3", "/audio/gallop.mp3", "/audio/gameplay.mp3", "/audio/highfive.mp3", "/audio/hit.mp3", "/audio/intro.mp3", "/audio/punch.mp3", "/audio/snap.mp3", "/audio/snort.mp3", "/audio/whoosh.mp3", "/fonts/baloo-2-latin-ext.woff2", "/fonts/baloo-2-latin.woff2", "/fonts/fonts.css", "/fonts/noto-sans-ol-chiki-latin-ext.woff2", "/fonts/noto-sans-ol-chiki-latin.woff2", "/fonts/noto-sans-ol-chiki-ol-chiki.woff2", "/fonts/rubik-dirt-latin-ext.woff2", "/fonts/rubik-dirt-latin.woff2", "/icon-192.png", "/icon-512.png", "/index.html", "/manifest.webmanifest", "/story.js", "/life.js", "/models/bull.json", "/models/casual_female.json", "/models/cow.json", "/models/casual_male.json", "/models/worker_female.json", "/vendor/three/build/three.module.min.js", "/vendor/three/examples/jsm/loaders/GLTFLoader.js", "/vendor/three/examples/jsm/utils/BufferGeometryUtils.js", "/vendor/three/examples/jsm/utils/SkeletonUtils.js" ];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // one by one, so a single failed file doesn't stop the rest from being saved
    await Promise.all(FILES.map(f => c.add(new Request(f, { cache: 'reload' })).catch(() => {})));
    await c.put('/', (await c.match('/index.html')) || await fetch('/'));
    self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('khuntau-') && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;            // nothing from other sites
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/') || url.pathname === '/turn' || url.pathname === '/sw.js') return; // live data never cached
  const page = req.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html';
  if (page || url.pathname === '/story.js') {
    // the page and the story code: network first, so a fresh page always gets the matching fresh story.js
    // (cache-first story.js could pair a new page with old code after a deploy); saved copy when offline or very slow
    e.respondWith((async () => {
      const c = await caches.open(CACHE), key = page ? '/' : '/story.js';
      try {
        const net = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 4000))]);
        if (net.ok) c.put(key, net.clone());
        return net;
      } catch (err) { return (await c.match(key)) || (page && await c.match('/index.html')) || Response.error(); }
    })());
    return;
  }
  // everything else (models, sounds, fonts, three.js): saved copy first, refreshed quietly in the background
  e.respondWith((async () => {
    const c = await caches.open(CACHE), hit = await c.match(req, { ignoreSearch: true });
    const refresh = fetch(req).then(r => { if (r.ok && r.status === 200) c.put(req, r.clone()); return r; }).catch(() => null);
    if (hit) { e.waitUntil(refresh); return hit; }
    return (await refresh) || Response.error();
  })());
});

self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let body = 'The bull is waiting. Keep your streak alive!';
    try {
      const d = await (await fetch('/api/board')).json();
      if (d.top && d.top[0]) body = `${d.top[0].n} leads today with ${d.top[0].p}. Can you take the ring before midnight?`;
      else if (d.yday) body = `Nobody has scored today. Yesterday ${d.yday.n} won with ${d.yday.p}. Be first!`;
    } catch (err) {}
    await self.registration.showNotification('Khuntau', { body, icon: '/icon-192.png', badge: '/icon-192.png', tag: 'khuntau-daily', renotify: true, data: { url: '/' } });
  })());
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) if ('focus' in c) return c.focus();
    return self.clients.openWindow('/');
  })());
});
