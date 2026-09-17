import crypto from "node:crypto";

const DEFAULT_RATE_LIMIT = 60;
const DEFAULT_WINDOW_MS = 60_000;
const MAX_RATE_ENTRIES = 50_000;

function parseOrigins() {
  return new Set(String(process.env.CORS_ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean));
}

const allowedOrigins = parseOrigins();
const trustProxy = String(process.env.TRUST_PROXY || "false").toLowerCase() === "true";

export function clientIp(req) {
  if (trustProxy) {
    const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    if (forwarded) return forwarded;
  }
  return req.socket.remoteAddress || "unknown";
}

export function rateIdentity(req) {
  const rawKey = String(req.headers["x-api-key"] || "").trim();
  if (rawKey) return `key:${crypto.createHash("sha256").update(rawKey).digest("hex")}`;
  return `ip:${clientIp(req)}`;
}

export function createRateLimiter({ max = DEFAULT_RATE_LIMIT, windowMs = DEFAULT_WINDOW_MS, prefix = "api" } = {}) {
  const buckets = new Map();
  return (req) => {
    const now = Date.now();
    const id = `${prefix}:${rateIdentity(req)}`;
    let bucket = buckets.get(id);
    if (!bucket || now - bucket.started >= windowMs) {
      if (buckets.size >= MAX_RATE_ENTRIES) {
        for (const [key, value] of buckets) {
          if (now - value.started >= windowMs) buckets.delete(key);
          if (buckets.size < MAX_RATE_ENTRIES) break;
        }
      }
      bucket = { started: now, count: 0 };
      buckets.set(id, bucket);
    }
    bucket.count += 1;
    const allowed = bucket.count <= max;
    return { allowed, remaining: Math.max(0, max - bucket.count), retryAfterSeconds: Math.max(1, Math.ceil((bucket.started + windowMs - now) / 1000)) };
  };
}

export function corsHeaders(req) {
  const origin = String(req.headers.origin || "").trim();
  const headers = {
    "access-control-allow-methods": "GET,HEAD,OPTIONS",
    "access-control-allow-headers": "content-type,x-api-key,accept-language,range",
    "access-control-max-age": "600",
    vary: "Origin, Accept-Encoding, Accept-Language",
  };
  if (origin && allowedOrigins.has("*")) headers["access-control-allow-origin"] = "*";
  else if (origin && allowedOrigins.has(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-credentials"] = "true";
  }
  return headers;
}

export function securityHeaders(req) {
  return {
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY",
    "cross-origin-resource-policy": "same-site",
    ...corsHeaders(req),
  };
}

export function requestBodyTooLarge(req, maxBytes = Number(process.env.MAX_REQUEST_BODY_BYTES || 1_048_576)) {
  const length = Number(req.headers["content-length"] || 0);
  return Number.isFinite(length) && length > maxBytes;
}

export function isLoopback(req) {
  const ip = String(req.socket.remoteAddress || "");
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

export function protectedPath(pathname) {
  return pathname === "/internal" || pathname.startsWith("/internal/") || pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/rechercher/internal/");
}
