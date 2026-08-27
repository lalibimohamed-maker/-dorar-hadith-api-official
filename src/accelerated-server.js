import http from "node:http";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream";
import { createAccelerationMesh, cachePolicyForPath } from "./acceleration-mesh.js";

const PUBLIC_PORT = Number(process.env.PORT || 3000);
const INTERNAL_PORT = Number(process.env.INTERNAL_PORT || PUBLIC_PORT + 1);
const HOST = "0.0.0.0";
const CACHE_MAX_BODY = Number(process.env.PERFORMANCE_CACHE_MAX_BODY || 2 * 1024 * 1024);
const mesh = createAccelerationMesh({
  maxEntries: process.env.PERFORMANCE_CACHE_ENTRIES,
  maxBytes: process.env.PERFORMANCE_CACHE_BYTES,
  minCompressBytes: process.env.PERFORMANCE_MIN_COMPRESS_BYTES,
});

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

function responseHeaders(upstreamHeaders, cachePolicy, encoding, bodyLength, etag, cacheStatus) {
  const headers = {
    "content-type": upstreamHeaders["content-type"] || "application/octet-stream",
    "x-acceleration-engine": "deen-allah-mesh",
    "x-acceleration-cache": cacheStatus,
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,HEAD,OPTIONS",
    "access-control-allow-headers": "content-type,x-api-key,accept-language,range",
    vary: "Accept-Encoding, Accept-Language",
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
      vary: "Accept-Encoding, Accept-Language",
    });
    return res.end();
  }
  const packed = mesh.compress(payload.body, req.headers["accept-encoding"]);
  const headers = responseHeaders(payload.headers, policy, packed.encoding, packed.body.length, etag, cacheStatus);
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
      headers: {
        ...req.headers,
        host: `127.0.0.1:${INTERNAL_PORT}`,
        connection: "keep-alive",
        "accept-encoding": "identity",
      },
      agent: upstreamAgent,
      timeout: 15_000,
    }, (upstream) => {
      const chunks = [];
      upstream.on("data", (chunk) => chunks.push(chunk));
      upstream.on("end", () => {
        resolve({
          status: upstream.statusCode || 502,
          headers: upstream.headers,
          body: Buffer.concat(chunks),
          etag: upstream.headers.etag || null,
        });
      });
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
      headers: {
        ...req.headers,
        host: `127.0.0.1:${INTERNAL_PORT}`,
        connection: "keep-alive",
        "accept-encoding": "identity",
      },
      agent: upstreamAgent,
      timeout: 15_000,
    }, resolve);
    request.once("timeout", () => request.destroy(new Error("Acceleration proxy upstream timeout")));
    request.once("error", reject);
    if (req.method === "GET" || req.method === "POST" || req.method === "PUT" || req.method === "PATCH") req.pipe(request);
    else request.end();
  });
}

async function proxyRequest(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,HEAD,OPTIONS",
      "access-control-allow-headers": "content-type,x-api-key,accept-language,range",
    });
    return res.end();
  }

  const pathname = String(req.url || "/").split("?", 1)[0];
  if (req.method === "GET" && pathname === "/performance") {
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-acceleration-engine": "deen-allah-mesh",
    });
    return res.end(JSON.stringify({ acceleration: mesh.profile(), upstreamPort: INTERNAL_PORT, cachePolicy: "automatic" }));
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
        mesh.set(key, origin.body, {
          ttlMs: policy.ttlMs,
          staleWhileRevalidate: policy.staleWhileRevalidate,
          status: origin.status,
          contentType: origin.headers["content-type"],
          etag: origin.etag || undefined,
        });
        return mesh.get(key) || origin;
      }
      return origin;
    });

    return writeJsonPayload(req, res, payload, policy, payload.status === 200 && isJson(payload.headers) ? "miss-store" : "bypass");
  }

  const upstream = await fetchUpstreamStream(req);
  if (!isJson(upstream.headers) || isStreamingMedia(upstream.headers) || req.method === "HEAD") {
    const headers = responseHeaders(upstream.headers, policy, null, undefined, upstream.headers.etag, "bypass");
    res.writeHead(upstream.statusCode || 502, headers);
    if (req.method === "HEAD") return res.end();
    return pipeline(upstream, res, () => {});
  }

  const chunks = [];
  for await (const chunk of upstream) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  const payload = {
    status: upstream.statusCode || 502,
    headers: upstream.headers,
    body,
    etag: etagFor(body, upstream.headers),
  };
  return writeJsonPayload(req, res, payload, policy, "bypass");
}

let shuttingDown = false;
const child = spawn(process.execPath, ["dorar_json_api.js"], {
  env: { ...process.env, PORT: String(INTERNAL_PORT) },
  stdio: "inherit",
});

child.once("exit", (code, signal) => {
  if (!shuttingDown) process.exit(code ?? (signal ? 1 : 0));
});

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

const server = http.createServer({ keepAlive: true }, (req, res) => {
  proxyRequest(req, res).catch((error) => {
    console.error(error);
    if (!res.headersSent) res.writeHead(502, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    res.end(JSON.stringify({ error: "Acceleration proxy failure" }));
  });
});
server.keepAliveTimeout = 65_000;
server.headersTimeout = 70_000;
server.requestTimeout = 30_000;
server.maxRequestsPerSocket = 1000;
server.listen(PUBLIC_PORT, HOST, () => console.log(`Deen Allah acceleration mesh listening on ${HOST}:${PUBLIC_PORT}; upstream ${INTERNAL_PORT}`));
