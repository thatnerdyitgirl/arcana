// Arcana Zen service worker (сборка 1791243939162)
const CACHE = "arcana-1791243939162";
const SHELL = ["/", "/manifest.webmanifest", "/assets/icon-192.png", "/assets/icon-512.png", "/assets/favicon.svg", "/apple-touch-icon.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  // страница: сначала сеть (свежая версия), без сети — из кэша
  if (r.mode === "navigate") { e.respondWith(fetch(r).then((res) => { const cp = res.clone(); caches.open(CACHE).then((c) => c.put("/", cp)); return res; }).catch(() => caches.match("/"))); return; }
  e.respondWith(caches.match(r).then((hit) => hit || fetch(r).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(r, cp)); } return res; })));
});
