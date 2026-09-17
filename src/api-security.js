import crypto from "node:crypto";
import net from "node:net";

const DEFAULT_RATE_LIMIT = 60;
const DEFAULT_WINDOW_MS = 60_000;
const MAX_RATE_ENTRIES = 50_000;
const DEFAULT_MAX_URL_BYTES = 8 * 1024;
const DEFAULT_MAX_ARRAY_ITEMS = 50;
const RATE_IDENTITY_SECRET = crypto.randomBytes(32);

function parseList(value) { return String(value || "").split(",").map((item) => item.trim()).filter(Boolean); }
function ipv4ToInt(ip) { const parts = ip.split(".").map(Number); if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null; return (((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0; }
function cidrContains(ip, cidr) { if (ip === cidr) return true; const [network, prefixText] = cidr.split("/"); if (!network || prefixText === undefined) return false; const prefix = Number(prefixText); if (net.isIPv4(ip) && net.isIPv4(network)) { if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false; const value = ipv4ToInt(ip); const base = ipv4ToInt(network); if (value === null || base === null) return false; const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0; return (value & mask) === (base & mask); } return false; }
function trustProxyEnabled() { return String(process.env.TRUST_PROXY || "false").toLowerCase() === "true"; }
function trustProxyMode() { return String(process.env.TRUST_PROXY_MODE || "xff").toLowerCase(); }
function trustedProxyCidrs() { return parseList(process.env.TRUSTED_PROXY_CIDRS); }
function edgeOnlyEnabled() { return String(process.env.EDGE_ONLY || "false").toLowerCase() === "true"; }
function allowedOrigins() { return new Set(parseList(process.env.CORS_ALLOWED_ORIGINS)); }

export function isTrustedProxy(req) { const remote = String(req.socket.remoteAddress || ""); if (remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1") return true; return trustedProxyCidrs().some((cidr) => cidrContains(remote, cidr)); }
export function clientIp(req) { if (trustProxyEnabled() && isTrustedProxy(req)) { if (trustProxyMode() === "cloudflare") { const cf = String(req.headers["cf-connecting-ip"] || "").trim(); if (cf && net.isIP(cf)) return cf; } const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim(); if (forwarded && net.isIP(forwarded)) return forwarded; } return req.socket.remoteAddress || "unknown"; }
export function edgeRequestAllowed(req) { if (!edgeOnlyEnabled()) return true; return isTrustedProxy(req); }
export function rateIdentity(req) { const rawKey = String(req.headers["x-api-key"] || "").trim(); if (rawKey) return `key:${crypto.createHmac("sha256", RATE_IDENTITY_SECRET).update(rawKey).digest("hex")}`; return `ip:${clientIp(req)}`; }

export function createRateLimiter({ max = DEFAULT_RATE_LIMIT, windowMs = DEFAULT_WINDOW_MS, prefix = "api" } = {}) {
  const buckets = new Map();
  return (req) => {
    const now = Date.now(); const id = `${prefix}:${rateIdentity(req)}`; let bucket = buckets.get(id);
    if (!bucket || now - bucket.started >= windowMs) { if (buckets.size >= MAX_RATE_ENTRIES) { for (const [key, value] of buckets) { if (now - value.started >= windowMs) buckets.delete(key); if (buckets.size < MAX_RATE_ENTRIES) break; } } bucket = { started: now, count: 0 }; buckets.set(id, bucket); }
    bucket.count += 1; const allowed = bucket.count <= max; return { allowed, remaining: Math.max(0, max - bucket.count), retryAfterSeconds: Math.max(1, Math.ceil((bucket.started + windowMs - now) / 1000)) };
  };
}

export function corsHeaders(req) {
  const origin = String(req.headers.origin || "").trim(); const origins = allowedOrigins();
  const headers = { "access-control-allow-methods": "GET,HEAD,OPTIONS", "access-control-allow-headers": "content-type,x-api-key,accept-language,range", "access-control-max-age": "600", vary: "Origin, Accept-Encoding, Accept-Language" };
  if (origin && origins.has("*")) headers["access-control-allow-origin"] = "*";
  else if (origin && origins.has(origin)) { headers["access-control-allow-origin"] = origin; headers["access-control-allow-credentials"] = "true"; }
  return headers;
}
export function securityHeaders(req) { return { "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "x-frame-options": "DENY", "cross-origin-resource-policy": "same-site", ...corsHeaders(req) }; }
export function requestBodyTooLarge(req, maxBytes = Number(process.env.MAX_REQUEST_BODY_BYTES || 1_048_576)) { const length = Number(req.headers["content-length"] || 0); return Number.isFinite(length) && length > maxBytes; }
export function requestUrlTooLarge(req, maxBytes = Number(process.env.MAX_URL_BYTES || DEFAULT_MAX_URL_BYTES)) { return Buffer.byteLength(String(req.url || "/"), "utf8") > maxBytes; }
export function queryArrayTooLarge(req, maxItems = Number(process.env.MAX_QUERY_ARRAY_ITEMS || DEFAULT_MAX_ARRAY_ITEMS)) { const url = new URL(req.url || "/", "http://localhost"); for (const key of ["translationIds", "tafsirIds"]) { const value = url.searchParams.get(key); if (value && value.split(",").filter(Boolean).length > maxItems) return true; } const judgments = url.searchParams.get("judgments"); if (judgments) { try { const parsed = JSON.parse(judgments); if (Array.isArray(parsed) && parsed.length > maxItems) return true; } catch {} } return false; }
export function isLoopback(req) { const ip = String(req.socket.remoteAddress || ""); return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1"; }
export function protectedPath(pathname) { return pathname === "/internal" || pathname.startsWith("/internal/") || pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/rechercher/internal/"); }
