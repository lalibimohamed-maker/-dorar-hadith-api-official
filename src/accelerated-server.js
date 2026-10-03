import http from "node:http";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream";
import { createAccelerationMesh, cachePolicyForPath } from "./acceleration-mesh.js";
import { clientIp, corsHeaders, createRateLimiter, edgeRequestAllowed, protectedPath, queryArrayTooLarge, requestBodyTooLarge, requestUrlTooLarge, securityHeaders } from "./api-security.js";

const PUBLIC_PORT = Number(process.env.PORT || 3000);
const INTERNAL_PORT = Number(process.env.INTERNAL_PORT || PUBLIC_PORT + 1);
const HOST = "0.0.0.0";
const CACHE_MAX_BODY = Number(process.env.PERFORMANCE_CACHE_MAX_BODY || 2 * 1024 * 1024);
const MAX_CONCURRENT_REQUESTS = Number(process.env.MAX_CONCURRENT_REQUESTS || 256);
const MAX_HEADER_BYTES = Number(process.env.MAX_HEADER_BYTES || 32 * 1024);
const PERFORMANCE_PUBLIC = String(process.env.PERFORMANCE_PUBLIC || "false").toLowerCase() === "true";
const mesh = createAccelerationMesh({
  maxEntries: process.env.PERFORMANCE_CACHE_ENTRIES,
  maxBytes: process.env.PERFORMANCE_CACHE_BYTES,
  minCompressBytes: process.env.PERFORMANCE_MIN_COMPRESS_BYTES,
});
const consumePublic = createRateLimiter({ max: Number(process.env.ACCELERATION_MAX_PER_MINUTE || 120), windowMs: 60_000, prefix: "accel" });
const consumeSensitive = createRateLimiter({ max: Number(process.env.ACCELERATION_SENSITIVE_MAX_PER_MINUTE || 20), windowMs: 60_000, prefix: "sensitive" });
let activeRequests = 0;

const upstreamAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 256,
  maxFreeSockets: 64,
  keepAliveMsecs: 15_000,
  scheduling: "lifo",
});

function publicKey(req) {
  return mesh.keyFor(req);
}

function responseHeaders(req, upstreamHeaders, cachePolicy, encoding, bodyLength, etag, cacheStatus) {
  const headers = {
    "content-type": upstreamHeaders["content-type"] || "application/octet-stream",
    "x-acceleration-engine": "deen-allah-mesh",
    "x-acceleration-cache": cacheStatus,
    ...securityHeaders(req),
  };
  if (encoding) headers["content-encoding"] = encoding;
  if (bodyLength !== undefined) headers["content-length"] = String(bodyLength);
  if (etag) headers.etag = etag;
  if (upstreamHeaders["last-modified"]) headers["last-modified"] = upstreamHeaders["last-modified"];
  if (upstreamHeaders["accept-ranges"]) headers["accept-ranges"] = upstreamHeaders["accept-ranges"];
  if (upstreamHeaders["content-range"]) headers["content-range"] = upstreamHeaders["content-range"];
  if (cachePolicy.cache) {
    const ttl = Math.max(0, Math.floor(Number(cachePolicy.ttlMs || 0) / 1000));
    const swr = Math.max(0, Math.floor(Number(cachePolicy.staleWhileRevalidate || 0)));
    headers["cache-control"] = `public, max-age=${ttl}, stale-while-revalidate=${swr}`;
  } else {
    headers["cache-control"] = "no-store";
  }
  return headers;
}

function isJson(upstreamHeaders) {
  return String(upstreamHeaders["content-type"] || "").toLowerCase().includes("application/json");
}

function isStreamingMedia(upstreamHeaders) {
  const contentType = String(upstreamHeaders["content-type"] || "").toLowerCase();
  return contentType.startsWith("audio/") || contentType.startsWith("video/") || contentType === "application/octet-stream";
}

function etagFor(body, upstreamHeaders) {
  return upstreamHeaders.etag || `"${crypto.createHash("sha256").update(body).digest("hex")}"`;
}

function writeJsonPayload(req, res, payload, policy, cacheStatus) {
  const etag = payload.etag || etagFor(payload.body, payload.headers);
  if (req.headers["if-none-match"] && req.headers["if-none-match"] === etag && payload.status === 200) {
    mesh.noteEtagHit();
    res.writeHead(304, {
      etag,
      "cache-control": policy.cache ? `public, max-age=0, stale-while-revalidate=${Math.max(0, Math.floor(Number(policy.staleWhileRevalidate || 0)))}` : "no-store",
      "x-acceleration-cache": cacheStatus,
      "x-acceleration-engine": "deen-allah-mesh",
      ...corsHeaders(req),
    });
    return res.end();
  }
  const packed = mesh.compress(payload.body, req.headers["accept-encoding"]);
  const headers = responseHeaders(req, payload.headers, policy, packed.encoding, packed.body.length, etag, cacheStatus);
  res.writeHead(payload.status, headers);
  if (req.method === "HEAD") return res.end();
  return res.end(packed.body);
}

function fetchJsonUpstream(req) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: "127.0.0.1",
      port: INTERNAL_PORT,
      method: "GET",
      path: req.url,
      headers: { ...req.headers, host: `127.0.0.1:${INTERNAL_PORT}`, connection: "keep-alive", "accept-encoding": "identity" },
      agent: upstreamAgent,
      timeout: 15_000,
    }, (upstream) => {
      const chunks = [];
      upstream.on("data", (chunk) => chunks.push(chunk));
      upstream.on("end", () => resolve({ status: upstream.statusCode || 502, headers: upstream.headers, body: Buffer.concat(chunks), etag: upstream.headers.etag || null }));
      upstream.on("error", reject);
    });
    request.once("timeout", () => request.destroy(new Error("Acceleration proxy upstream timeout")));
    request.once("error", reject);
    request.end();
  });
}

function fetchUpstreamStream(req) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: "127.0.0.1",
      port: INTERNAL_PORT,
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: `127.0.0.1:${INTERNAL_PORT}`, connection: "keep-alive", "accept-encoding": "identity" },
      agent: upstreamAgent,
      timeout: 15_000,
    }, resolve);
    request.once("timeout", () => request.destroy(new Error("Acceleration proxy upstream timeout")));
    request.once("error", reject);
    if (["GET", "POST", "PUT", "PATCH"].includes(req.method)) req.pipe(request);
    else request.end();
  });
}

async function proxyRequest(req, res) {
  if (!edgeRequestAllowed(req)) {
    res.writeHead(403, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...securityHeaders(req) });
    return res.end(JSON.stringify({ error: "Origin accepts traffic only from the configured trusted edge" }));
  }
  if (req.rawHeaders.join("\r\n").length > MAX_HEADER_BYTES) {
    res.writeHead(431, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...securityHeaders(req) });
    return res.end(JSON.stringify({ error: "Request headers too large" }));
  }
  if (requestUrlTooLarge(req)) {
    res.writeHead(414, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...securityHeaders(req) });
    return res.end(JSON.stringify({ error: "Request URL too large" }));
  }
  if (queryArrayTooLarge(req)) {
    res.writeHead(413, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...securityHeaders(req) });
    return res.end(JSON.stringify({ error: "Query batch exceeds configured item limit" }));
  }
  if (requestBodyTooLarge(req)) {
    res.writeHead(413, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...securityHeaders(req) });
    req.resume();
    return res.end(JSON.stringify({ error: "Request body too large" }));
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204, { ...corsHeaders(req), "cache-control": "no-store" });
    return res.end();
  }

  const pathname = String(req.url || "/").split("?", 1)[0];
  const limiter = protectedPath(pathname) ? consumeSensitive : consumePublic;
  const limit = limiter(req);
  res.setHeader("x-ratelimit-limit", String(protectedPath(pathname) ? process.env.ACCELERATION_SENSITIVE_MAX_PER_MINUTE || 20 : process.env.ACCELERATION_MAX_PER_MINUTE || 120));
  res.setHeader("x-ratelimit-remaining", String(limit.remaining));
  if (!limit.allowed) {
    res.setHeader("retry-after", String(limit.retryAfterSeconds));
    res.writeHead(429, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...securityHeaders(req) });
    return res.end(JSON.stringify({ error: "Rate limit exceeded", retryAfterSeconds: limit.retryAfterSeconds }));
  }

  if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
    res.writeHead(503, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...securityHeaders(req), "retry-after": "1" });
    return res.end(JSON.stringify({ error: "Server concurrency limit reached" }));
  }
  activeRequests += 1;
  res.once("close", () => { activeRequests = Math.max(0, activeRequests - 1); });

  if (protectedPath(pathname) && !req.headers["x-api-key"]) {
    res.writeHead(401, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...securityHeaders(req) });
    return res.end(JSON.stringify({ error: "API key required" }));
  }

  if (req.method === "GET" && pathname === "/performance") {
    if (!PERFORMANCE_PUBLIC && !req.headers["x-api-key"]) {
      res.writeHead(404, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...securityHeaders(req) });
      return res.end(JSON.stringify({ error: "Not found" }));
    }
    res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-acceleration-engine": "deen-allah-mesh", ...securityHeaders(req) });
    return res.end(JSON.stringify({ acceleration: mesh.profile(), upstreamPort: "internal", cachePolicy: "automatic", activeRequests, client: clientIp(req) }));
  }

  const policy = req.method === "GET" ? cachePolicyForPath(pathname) : { cache: false };
  const cacheable = req.method === "GET" && policy.cache && !req.headers["x-api-key"] && !req.headers.range;
  if (cacheable) {
    const key = publicKey(req);
    const cached = mesh.get(key);
    if (cached) return writeJsonPayload(req, res, cached, policy, "hit");
    const payload = await mesh.singleFlight(key, async () => {
      const origin = await fetchJsonUpstream(req);
      if (origin.status === 200 && isJson(origin.headers) && !isStreamingMedia(origin.headers) && origin.body.length <= CACHE_MAX_BODY) {
        mesh.set(key, origin.body, { ttlMs: policy.ttlMs, staleWhileRevalidate: policy.staleWhileRevalidate, status: origin.status, contentType: origin.headers["content-type"], etag: origin.etag || undefined });
        return mesh.get(key) || origin;
      }
      return origin;
    });
    return writeJsonPayload(req, res, payload, policy, payload.status === 200 && isJson(payload.headers) ? "miss-store" : "bypass");
  }

  const upstream = await fetchUpstreamStream(req);
  if (!isJson(upstream.headers) || isStreamingMedia(upstream.headers) || req.method === "HEAD") {
    const headers = responseHeaders(req, upstream.headers, policy, null, undefined, upstream.headers.etag, "bypass");
    res.writeHead(upstream.statusCode || 502, headers);
    if (req.method === "HEAD") return res.end();
    return pipeline(upstream, res, () => {});
  }
  const chunks = [];
  for await (const chunk of upstream) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  return writeJsonPayload(req, res, { status: upstream.statusCode || 502, headers: upstream.headers, body, etag: etagFor(body, upstream.headers) }, policy, "bypass");
}

let shuttingDown = false;
const child = spawn(process.execPath, ["dorar_json_api.js"], {
  env: { ...process.env, PORT: String(INTERNAL_PORT), HOST: "127.0.0.1" },
  stdio: "inherit",
});
child.once("exit", (code, signal) => { if (!shuttingDown) process.exit(code ?? (signal ? 1 : 0)); });
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Acceleration mesh shutting down after ${signal}`);
  upstreamAgent.destroy();
  child.kill("SIGTERM");
  setTimeout(() => process.exit(0), 5_000).unref();
}
process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));

const server = http.createServer({ keepAlive: true, maxHeaderSize: MAX_HEADER_BYTES }, (req, res) => {
  proxyRequest(req, res).catch((error) => {
    console.error(error);
    if (!res.headersSent) res.writeHead(502, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...securityHeaders(req) });
    res.end(JSON.stringify({ error: "Acceleration proxy failure" }));
  });
});
server.keepAliveTimeout = 65_000;
server.headersTimeout = 70_000;
server.requestTimeout = 30_000;
server.maxRequestsPerSocket = 1000;
server.listen(PUBLIC_PORT, HOST, () => console.log(`Deen Allah acceleration mesh listening on ${HOST}:${PUBLIC_PORT}; internal ${INTERNAL_PORT} bound to loopback`));
