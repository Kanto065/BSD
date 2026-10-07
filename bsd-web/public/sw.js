// App shell worker for the Privilege Pass. It caches the build files and the last pages so the pass details open
// offline. It never caches API answers (they are on another origin and are not handled here), so no token or code is
// ever stored, and the QR needs the network by design.
const SHELL = "bsd-pass-shell-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  const asset = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/pwa-icon/");
  if (asset) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(SHELL).then((c) => c.put(req, res.clone()));
            return res;
          })
      )
    );
  } else if (req.mode === "navigate") {
    // Network first so the page is always current, the cached copy is only for offline.
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(SHELL).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || Response.error()))
    );
  }
});
