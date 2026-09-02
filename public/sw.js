const APP_CACHE = "deen-allah-app-v1";
const PDF_CACHE = "deen-allah-pdf-v1";
const APP_SHELL = ["/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const accept = request.headers.get("accept") || "";
  const pathname = new URL(request.url).pathname.toLowerCase();
  const isPdf = accept.includes("application/pdf") || pathname.endsWith(".pdf");

  if (!isPdf) return;

  event.respondWith((async () => {
    const cache = await caches.open(PDF_CACHE);
    const cached = await cache.match(request.url);
    if (cached) return cached;

    if (!self.navigator?.onLine) {
      return new Response("Offline PDF is not downloaded on this device.", {
        status: 504,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }

    const response = await fetch(request);
    if (response.ok && response.type !== "opaque") {
      await cache.put(request.url, response.clone());
    }
    return response;
  })().catch(() => new Response("PDF unavailable offline.", {
    status: 504,
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  })));
});
