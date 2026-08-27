import crypto from "node:crypto";
import zlib from "node:zlib";

const DEFAULT_MAX_ENTRIES = 1000;
const DEFAULT_MAX_BYTES = 32 * 1024 * 1024;

function toPositiveInt(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

export function createAccelerationMesh(options = {}) {
  const maxEntries = toPositiveInt(options.maxEntries, DEFAULT_MAX_ENTRIES);
  const maxBytes = toPositiveInt(options.maxBytes, DEFAULT_MAX_BYTES);
  const minCompressBytes = toPositiveInt(options.minCompressBytes, 1024);
  const cache = new Map();
  const inFlight = new Map();
  let bytes = 0;
  let hits = 0;
  let misses = 0;
  let compressedResponses = 0;
  let etagHits = 0;
  let coalesced = 0;

  function touch(key, entry) {
    cache.delete(key);
    cache.set(key, entry);
  }

  function remove(key) {
    const entry = cache.get(key);
    if (!entry) return;
    bytes -= entry.size;
    cache.delete(key);
  }

  function prune() {
    while (cache.size > maxEntries || bytes > maxBytes) {
      const first = cache.keys().next().value;
      if (first === undefined) break;
      remove(first);
    }
  }

  function keyFor(req) {
    const method = String(req.method || "GET").toUpperCase();
    const url = String(req.url || "/");
    const language = String(req.headers?.["accept-language"] || "").slice(0, 128);
    return crypto.createHash("sha256").update(`${method}\n${url}\n${language}`).digest("hex");
  }

  function get(key) {
    const entry = cache.get(key);
    if (!entry) {
      misses += 1;
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      remove(key);
      misses += 1;
      return null;
    }
    hits += 1;
    touch(key, entry);
    return entry;
  }

  function set(key, body, meta = {}) {
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
    if (buffer.length > maxBytes) return;
    remove(key);
    const entry = {
      body: buffer,
      size: buffer.length,
      status: Number(meta.status || 200),
      contentType: meta.contentType || "application/json; charset=utf-8",
      etag: meta.etag || `"${crypto.createHash("sha256").update(buffer).digest("hex")}"`,
      expiresAt: Date.now() + toPositiveInt(meta.ttlMs, 30_000),
    };
    cache.set(key, entry);
    bytes += entry.size;
    prune();
  }

  async function singleFlight(key, work) {
    if (inFlight.has(key)) {
      coalesced += 1;
      return inFlight.get(key);
    }
    const promise = Promise.resolve().then(work).finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
    return promise;
  }

  function compress(body, acceptEncoding) {
    const input = Buffer.isBuffer(body) ? body : Buffer.from(body);
    if (input.length < minCompressBytes) return { body: input, encoding: null };
    const accepts = String(acceptEncoding || "").toLowerCase();
    if (accepts.includes("br")) {
      compressedResponses += 1;
      return { body: zlib.brotliCompressSync(input), encoding: "br" };
    }
    if (accepts.includes("gzip")) {
      compressedResponses += 1;
      return { body: zlib.gzipSync(input, { level: zlib.constants.Z_BEST_SPEED }), encoding: "gzip" };
    }
    return { body: input, encoding: null };
  }

  function profile() {
    return {
      enabled: true,
      entries: cache.size,
      bytes,
      maxEntries,
      maxBytes,
      inFlight: inFlight.size,
      hits,
      misses,
      hitRate: hits + misses ? Number((hits / (hits + misses)).toFixed(4)) : 0,
      compressedResponses,
      etagHits,
      coalesced,
    };
  }

  function noteEtagHit() {
    etagHits += 1;
  }

  return { keyFor, get, set, singleFlight, compress, profile, noteEtagHit };
}

export function cachePolicyForPath(pathname) {
  const path = String(pathname || "/");
  if (path === "/health" || path === "/performance" || path === "/") return { cache: false };
  if (path === "/search" || path.startsWith("/research/scholars") || path.startsWith("/fiqh/research")) return { cache: true, ttlMs: 8_000, staleWhileRevalidate: 30 };
  if (path.startsWith("/quran/ayah") || path.startsWith("/quran/translations")) return { cache: true, ttlMs: 120_000, staleWhileRevalidate: 600 };
  return { cache: true, ttlMs: 60_000, staleWhileRevalidate: 300 };
}
