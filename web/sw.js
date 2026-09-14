const CACHE_NAME = "deen-allah-offline-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./self-test.html",
  "./app.js",
  "./voice.js",
  "./ya-bawabat-al-ilm.js",
  "./self-test-engine.js",
  "./self-test-question-bank.json",
  "./self-test-question-schema.json",
  "./manifest.webmanifest",
  "./assets/pwa-icon-192.svg",
  "./offline.html"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // API/global-source search stays network-first: offline mode must never pretend
  // that a global web search succeeded when the network is unavailable.
  if (url.pathname.includes("/api/") || url.pathname.endsWith("/health") || url.pathname.endsWith("/sources")) {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ offline: true, results: [], message: "البحث العالمي يحتاج إلى اتصال بالإنترنت. المحتوى المحلي المحفوظ يبقى متاحًا دون اتصال." }), { status: 503, headers: { "Content-Type": "application/json; charset=utf-8" } })));
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok && url.origin === location.origin) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }).catch(() => caches.match("./offline.html")))
  );
});
