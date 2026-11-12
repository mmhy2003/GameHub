// GameHub service worker (GH-87). Makes the app installable and shows /offline.html
// when a page can't load. Games are online-only: it never caches pages, assets, API or WS.
// Bump the version when offline.html or the precached icon changes.
const CACHE = "gamehub-offline-v1";
const PRECACHE = ["/offline.html", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // The offline page's icon: network first, the precached copy when offline
  if (url.origin === self.location.origin && url.pathname === "/icons/icon-192.png") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match("/icons/icon-192.png").then((response) => response || Response.error()),
      ),
    );
    return;
  }
  // Only page loads get the offline fallback; everything else goes straight to the network
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match("/offline.html").then((response) => response || Response.error()),
    ),
  );
});
