/* Lunchtime Larry — shell + menu cache for installed PWA */
const CACHE = "larry-shell-v2";
const SHELL = [
  "./",
  "./index.html",
  "./alternativen.html",
  "./styles.css",
  "./app.js",
  "./likes.js",
  "./vote.js",
  "./voteClient.js",
  "./icons.js",
  "./locations.js",
  "./larryCorner.js",
  "./larryLines.js",
  "./calendar.js",
  "./dom.js",
  "./menuFetch.js",
  "./boardRender.js",
  "./boardGestures.js",
  "./canteens.json",
  "./firebase.json",
  "./larry.svg",
  "./leisure-larry.svg",
  "./laughing-larry.svg",
  "./lazy-larry.svg",
  "./manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith("/data/menu.json") || url.pathname.endsWith("menu.json")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).then((res) => {
      if (res.ok && url.pathname.match(/\.(js|css|svg|png|webmanifest|json|html)$/)) {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return res;
    })),
  );
});
