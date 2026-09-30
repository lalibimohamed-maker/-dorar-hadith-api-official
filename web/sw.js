importScripts("./omega-offline-delta-sync.js");

const CACHE_NAME = "deen-allah-offline-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./self-test.html",
  "./app.js",
  "./omega-offline-store.js",
  "./omega-hardware-guardian.js",
  "./omega-audio-session.js",
  "./omega-visual-pruner.js",
  "./omega-multimodal-context-guard.js",
  "./omega-offline-delta-sync.js",
  "./omega-offline-evidence-worker.js",
  "./offline-omega-ui.js",
  "./omega-local-provider.js",
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

self.addEventListener("message", event => {
  const message = event.data || {};
  if (message.type !== "OMEGA_APPLY_EVIDENCE_DELTA") return;
  event.waitUntil((async () => {
    try {
      const result = message.url
        ? await self.deenAllahOmegaOfflineSync.fetchAndApply(message.url, {
            mode: "online_only",
            trustedPublicKeys: message.trustedPublicKeys || {}
          })
        : await self.deenAllahOmegaOfflineSync.applyDelta(message.delta, {
            requireSignature: true,
            trustedPublicKeys: message.trustedPublicKeys || {}
          });
      event.source?.postMessage?.({ type: "OMEGA_EVIDENCE_DELTA_RESULT", ok: true, result });
    } catch (error) {
      event.source?.postMessage?.({
        type: "OMEGA_EVIDENCE_DELTA_RESULT",
        ok: false,
        error: String(error?.message ?? error)
      });
    }
  })());
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
