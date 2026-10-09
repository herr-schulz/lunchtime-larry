/* Lunchtime Larry — shell + menu cache for installed PWA */
const CACHE = "larry-shell-v44";
const SHELL = [
  "./",
  "./index.html",
  "./alternativen.html",
  "./styles.css",
  "./app.js",
  "./likes.js",
  "./vote.js",
  "./voteClient.js",
  "./devPreview.js",
  "./icons.js",
  "./locations.js",
  "./larryCorner.js",
  "./larryLines.js",
  "./calendar.js",
  "./dom.js",
  "./menuFetch.js",
  "./boardRender.js",
  "./boardGestures.js",
  "./dice.js",
  "./diceReel.js",
  "./spotDice.js",
  "./updateShell.js",
  "./canteens.json",
  "./firebase.json",
  "./larry.svg",
  "./leisure-larry.svg",
  "./laughing-larry.svg",
  "./lazy-larry.svg",
  "./manifest.webmanifest",
];

function shouldBypassCache(pathname) {
  const file = pathname.split("/").pop() || "";
  if (
    file === "version.json" ||
    file === "sw.js" ||
    file === "index.html" ||
    file === "alternativen.html"
  ) {
    return true;
  }
  return pathname.endsWith("/");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const old = keys.filter((key) => key !== CACHE);
      await Promise.all(old.map((key) => caches.delete(key)));
      await self.clients.claim();
      if (!old.length) return;
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      await Promise.all(
        windows.map((client) =>
          typeof client.navigate === "function"
            ? client.navigate(client.url).catch(() => {})
            : Promise.resolve(),
        ),
      );
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const live = shouldBypassCache(url.pathname);
  const versionFile = (url.pathname.split("/").pop() || "") === "version.json";
  const menuFile =
    url.pathname.endsWith("/data/menu.json") || url.pathname.endsWith("menu.json");

  if (live || menuFile) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && !versionFile) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok && url.pathname.match(/\.(js|css|svg|png|webmanifest|json|html)$/)) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
