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

function responseHeaders(upstream, cachePolicy, encoding, bodyLength) {
  const headers = {
    "content-type": upstream.headers["content-type"] || "application/octet-stream",
    "x-acceleration-engine": "deen-allah-mesh",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,HEAD,OPTIONS",
    "access-control-allow-headers": "content-type,x-api-key,accept-language,range",
  };
  if (encoding) headers["content-encoding"] = encoding;
  if (bodyLength !== undefined) headers["content-length"] = String(bodyLength);
  if (upstream.headers.etag) headers.etag = upstream.headers.etag;
  if (upstream.headers["last-modified"]) headers["last-modified"] = upstream.headers["last-modified"];
  if (upstream.headers["accept-ranges"]) headers["accept-ranges"] = upstream.headers["accept-ranges"];
  if (upstream.headers["content-range"]) headers["content-range"] = upstream.headers["content-range"];
  if (cachePolicy.cache) {
    const swr = Number(cachePolicy.staleWhileRevalidate || 0);
    headers["cache-control"] = `public, max-age=${Math.max(0, Math.floor(cachePolicy.ttlMs / 1000))}, stale-while-revalidate=${swr}`;
  } else {
    headers["cache-control"] = "no-store";
  }
  headers.vary = "Accept-Encoding, Accept-Language";
  return headers;
}

function isJson(upstream) {
  return String(upstream.headers["content-type"] || "").toLowerCase().includes("application/json");
}

function isStreamingMedia(upstream) {
  const contentType = String(upstream.headers["content-type"] || "").toLowerCase();
  return contentType.startsWith("audio/") || contentType.startsWith("video/") || contentType === "application/octet-stream";
}

async function writeJsonFromCache(req, res, entry) {
  if (req.headers["if-none-match"] && req.headers["if-none-match"] === entry.etag) {
    mesh.noteEtagHit();
    res.writeHead(304, { etag: entry.etag, "cache-control": "public, max-age=0", "x-acceleration-cache": "hit" });
    res.end();
    return;
  }
  const packed = mesh.compress(entry.body, req.headers["accept-encoding"]);
  const headers = {
    "content-type": entry.contentType,
    etag: entry.etag,
    "cache-control": "public, max-age=30, stale-while-revalidate=300",
    "content-length": String(packed.body.length),
    "x-acceleration-cache": "hit",
    "x-acceleration-engine": "deen-allah-mesh",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "access-control-allow-origin": "*",
    vary: "Accept-Encoding, Accept-Language",
  };
  if (packed.encoding) headers["content-encoding"] = packed.encoding;
  res.writeHead(200, headers);
  if (req.method !== "HEAD") res.end(packed.body);
  else res.end();
}

function fetchUpstream(req) {
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
    req.pipe(request);
  });
}

async function proxyRequest(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,HEAD,OPTIONS", "access-control-allow-headers": "content-type,x-api-key,accept-language,range" });
    return res.end();
  }

  const pathname = String(req.url || "/").split("?", 1)[0];
  if (req.method === "GET" && pathname === "/performance") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-acceleration-engine": "deen-allah-mesh" });
    return res.end(JSON.stringify({ acceleration: mesh.profile(), upstreamPort: INTERNAL_PORT, cachePolicy: "automatic" }));
  }

  const policy = req.method === "GET" ? cachePolicyForPath(pathname) : { cache: false };
  const cacheable = req.method === "GET" && policy.cache && !req.headers["x-api-key"] && !req.headers.range;
  const key = cacheable ? publicKey(req) : null;

  if (cacheable) {
    const cached = mesh.get(key);
    if (cached) return writeJsonFromCache(req, res, cached);
  }

  const work = async () => {
    const upstream = await fetchUpstream(req);
    if (!isJson(upstream) || isStreamingMedia(upstream) || req.method === "HEAD") {
      const headers = responseHeaders(upstream, policy, null);
      res.writeHead(upstream.statusCode || 502, headers);
      if (req.method === "HEAD") return res.end();
      return pipeline(upstream, res, () => {});
    }

    const chunks = [];
    let size = 0;
    for await (const chunk of upstream) {
      size += chunk.length;
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);
    const status = upstream.statusCode || 502;
    const contentType = upstream.headers["content-type"] || "application/json; charset=utf-8";
    if (status === 200 && cacheable && body.length <= CACHE_MAX_BODY) {
      mesh.set(key, body, { ttlMs: policy.ttlMs, status, contentType });
    }
    const entry = cacheable ? mesh.get(key) : null;
    const rawEntry = entry || {
      body,
      contentType,
      etag: `"${crypto.createHash("sha256").update(body).digest("hex")}"`,
    };
    if (req.headers["if-none-match"] && req.headers["if-none-match"] === rawEntry.etag && status === 200) {
      mesh.noteEtagHit();
      res.writeHead(304, { etag: rawEntry.etag, "cache-control": "public, max-age=0", "x-acceleration-cache": entry ? "hit" : "origin" });
      return res.end();
    }
    const packed = mesh.compress(body, req.headers["accept-encoding"]);
    const headers = responseHeaders(upstream, policy, packed.encoding, packed.body.length);
    headers.etag = rawEntry.etag;
    headers["x-acceleration-cache"] = entry ? "miss-store" : "bypass";
    res.writeHead(status, headers);
    res.end(packed.body);
  };

  if (cacheable) return mesh.singleFlight(key, work);
  return work();
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
