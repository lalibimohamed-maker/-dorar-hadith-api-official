import http from "node:http";
import { URL } from "node:url";
import crypto from "node:crypto";
import { searchDorar } from "./src/dorar-client.js";
import { getMaqasid, getSource, listCategories, listSources } from "./src/source-registry.js";
import { DEFAULT_LOCALE, getLocale, listLocales, localeFromRequest } from "./src/i18n.js";

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";
const MAX_QUERY_LENGTH = Number(process.env.MAX_QUERY_LENGTH || 300);
const PUBLIC_WINDOW_MS = 60_000;
const PUBLIC_MAX_PER_WINDOW = Number(process.env.PUBLIC_MAX_PER_MINUTE || 30);
const APP_MAX_PER_WINDOW = Number(process.env.APP_MAX_PER_MINUTE || 120);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 10_000);

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
    "access-control-allow-headers": "content-type,x-api-key,accept-language",
    ...extraHeaders
  });
  res.end(body);
}

function requireString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const requestedLocale = url.searchParams.get("lang") || req.headers["accept-language"] || DEFAULT_LOCALE;
  const locale = localeFromRequest(requestedLocale);

  if (url.pathname === "/health") {
    return sendJson(res, 200, {
      ok: true,
      service: "dorar-hadith-api-official",
      source: "Dorar.net",
      registry: "sunny-islamic-research-sources",
      locale,
      timestamp: new Date().toISOString()
    });
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
      name: "موسوعة الدرر",
      service: "Dorar Hadith API Official",
      version: "0.5.0",
      locale,
      direction: locale.dir,
      access: app ? { type: "application", name: app.name, dailyLimit: app.dailyLimit } : { type: "public" },
      endpoints: {
        health: "/health",
        locales: "/locales",
        search: "/search?q=...&lang=ar",
        sources: "/sources",
        categories: "/categories",
        maqasid: "/maqasid"
      },
      source: "Dorar.net"
    });
  }

  if (url.pathname === "/locales") {
    return sendJson(res, 200, { default: DEFAULT_LOCALE, locales: listLocales() });
  }

  if (url.pathname === "/categories") {
    return sendJson(res, 200, { locale, direction: locale.dir, categories: listCategories() });
  }

  if (url.pathname === "/sources") {
    const category = requireString(url.searchParams.get("category"));
    const role = requireString(url.searchParams.get("role"));
    return sendJson(res, 200, { locale, sources: listSources({ category, role }) });
  }

  if (url.pathname === "/sources/one") {
    const id = requireString(url.searchParams.get("id"));
    if (!id) return sendJson(res, 400, { error: "Missing required query parameter: id" });
    const source = getSource(id);
    if (!source) return sendJson(res, 404, { error: "Source not found" });
    return sendJson(res, 200, { locale, source });
  }

  if (url.pathname === "/maqasid") {
    return sendJson(res, 200, { locale, maqasid: getMaqasid() });
  }

  if (url.pathname === "/search") {
    const q = (url.searchParams.get("q") || "").trim();
    if (!q) return sendJson(res, 400, { error: "Missing required query parameter: q" });
    if (q.length > MAX_QUERY_LENGTH) return sendJson(res, 413, { error: `Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters` });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const data = await searchDorar(q, { signal: controller.signal });
      return sendJson(res, 200, {
        query: q,
        locale,
        direction: locale.dir,
        source: getSource("dorar"),
        data,
        researchPolicy: "Source attribution is preserved; presence in a book is not itself a grading of authenticity. Original Arabic source text remains distinct from translations."
      });
    } catch (error) {
      const message = error?.name === "AbortError" ? "Dorar.net request timed out" : "Unable to retrieve results from Dorar.net";
      return sendJson(res, 502, { error: message, source: "Dorar.net", locale });
    } finally {
      clearTimeout(timeout);
    }
  }

  return sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, HOST, () => console.log(`Dorar API listening on ${HOST}:${PORT}`));
