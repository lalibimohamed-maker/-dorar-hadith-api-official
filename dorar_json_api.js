import http from "node:http";
import { URL } from "node:url";
import crypto from "node:crypto";
import { searchDorar } from "./src/dorar-client.js";

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";
const MAX_QUERY_LENGTH = Number(process.env.MAX_QUERY_LENGTH || 300);
const PUBLIC_WINDOW_MS = 60_000;
const PUBLIC_MAX_PER_WINDOW = Number(process.env.PUBLIC_MAX_PER_MINUTE || 30);
const APP_MAX_PER_WINDOW = Number(process.env.APP_MAX_PER_MINUTE || 120);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 10_000);

// Optional named application keys. Store only SHA-256 hashes in APP_KEYS_JSON.
// Example value: [{"name":"My App","keyHash":"<sha256>","dailyLimit":100000,"enabled":true}]
const appKeys = new Map();
try {
  const configured = JSON.parse(process.env.APP_KEYS_JSON || "[]");
  for (const item of configured) {
    if (item?.name && item?.keyHash) appKeys.set(item.keyHash, {
      name: String(item.name).slice(0, 100),
      dailyLimit: Number(item.dailyLimit || 100000),
      enabled: item.enabled !== false
    });
  }
} catch {
  console.error("Invalid APP_KEYS_JSON; application keys disabled.");
}

const counters = new Map();
function hashKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}
function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
}
function consume(id, max, windowMs) {
  const now = Date.now();
  const current = counters.get(id);
  if (!current || now - current.started >= windowMs) {
    counters.set(id, { started: now, count: 1 });
    return true;
  }
  if (current.count >= max) return false;
  current.count += 1;
  return true;
}

function sendJson(res, status, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-allow-headers": "content-type,x-api-key",
    ...extraHeaders
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/health") {
    return sendJson(res, 200, { ok: true, service: "dorar-hadith-api-official", source: "Dorar.net", timestamp: new Date().toISOString() });
  }

  const rawKey = String(req.headers["x-api-key"] || "").trim();
  const keyHash = rawKey ? hashKey(rawKey) : null;
  const app = keyHash ? appKeys.get(keyHash) : null;

  if (rawKey && (!app || !app.enabled)) {
    return sendJson(res, 401, { error: "Invalid or disabled API key" });
  }

  const identity = app ? `app:${keyHash}` : `ip:${clientIp(req)}`;
  const allowed = consume(identity, app ? APP_MAX_PER_WINDOW : PUBLIC_MAX_PER_WINDOW, PUBLIC_WINDOW_MS);
  if (!allowed) return sendJson(res, 429, { error: "Rate limit exceeded", retryAfterSeconds: 60 });

  if (url.pathname === "/") {
    return sendJson(res, 200, {
      name: "Dorar Hadith API Official",
      version: "0.3.0",
      access: app ? { type: "application", name: app.name, dailyLimit: app.dailyLimit } : { type: "public" },
      endpoints: { health: "/health", search: "/search?q=..." },
      source: "Dorar.net"
    });
  }

  if (url.pathname === "/search") {
    const q = (url.searchParams.get("q") || "").trim();
    if (!q) return sendJson(res, 400, { error: "Missing required query parameter: q" });
    if (q.length > MAX_QUERY_LENGTH) return sendJson(res, 413, { error: `Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters` });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const data = await searchDorar(q, { signal: controller.signal });
      return sendJson(res, 200, { query: q, source: "Dorar.net", data });
    } catch (error) {
      const message = error?.name === "AbortError" ? "Dorar.net request timed out" : "Unable to retrieve results from Dorar.net";
      return sendJson(res, 502, { error: message, source: "Dorar.net" });
    } finally {
      clearTimeout(timeout);
    }
  }

  return sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, HOST, () => console.log(`Dorar API listening on ${HOST}:${PORT}`));
