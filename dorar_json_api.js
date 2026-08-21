import http from "node:http";
import { URL } from "node:url";
import crypto from "node:crypto";
import { unifiedSearch } from "./src/unified-search.js";
import { getMaqasid, getSource, listCategories, listSources } from "./src/source-registry.js";
import { listAuthors, listBooks } from "./src/book-catalog.js";
import { DEFAULT_LOCALE, detectLocale, listLocales, localeFromRequest } from "./src/i18n.js";
import { getQuranAyah } from "./src/quran-ayah.js";
import { listQuranTranslations } from "./src/quran-translations.js";

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
  for (const item of configured) if (item?.name && item?.keyHash) appKeys.set(item.keyHash, { name: String(item.name).slice(0, 100), dailyLimit: Number(item.dailyLimit || 100000), enabled: item.enabled !== false });
} catch { console.error("Invalid APP_KEYS_JSON; application keys disabled."); }

const counters = new Map();
function hashKey(key) { return crypto.createHash("sha256").update(key).digest("hex"); }
function clientIp(req) { return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim(); }
function consume(id, max, windowMs) {
  const now = Date.now(), current = counters.get(id);
  if (!current || now - current.started >= windowMs) { counters.set(id, { started: now, count: 1 }); return true; }
  if (current.count >= max) return false;
  current.count += 1; return true;
}
function sendJson(res, status, data, extraHeaders = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "access-control-allow-origin": "*", "access-control-allow-methods": "GET,OPTIONS", "access-control-allow-headers": "content-type,x-api-key,accept-language", ...extraHeaders });
  res.end(JSON.stringify(data));
}
function requireString(value) { return typeof value === "string" && value.trim() ? value.trim() : null; }

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const requestedLanguage = requireString(url.searchParams.get("lang"));
  const queryText = String(url.searchParams.get("q") || "").trim();
  const locale = requestedLanguage
    ? localeFromRequest(requestedLanguage)
    : (detectLocale(queryText) || localeFromRequest(req.headers["accept-language"] || DEFAULT_LOCALE));

  if (url.pathname === "/health") return sendJson(res, 200, { ok: true, service: "dorar-hadith-api-official", source: "Dorar.net", locale, timestamp: new Date().toISOString() });

  const rawKey = String(req.headers["x-api-key"] || "").trim();
  const keyHash = rawKey ? hashKey(rawKey) : null;
  const app = keyHash ? appKeys.get(keyHash) : null;
  if (rawKey && (!app || !app.enabled)) return sendJson(res, 401, { error: "Invalid or disabled API key" });
  if (!consume(app ? `app:${keyHash}` : `ip:${clientIp(req)}`, app ? APP_MAX_PER_WINDOW : PUBLIC_MAX_PER_WINDOW, PUBLIC_WINDOW_MS)) return sendJson(res, 429, { error: "Rate limit exceeded", retryAfterSeconds: 60 });

  if (url.pathname === "/") return sendJson(res, 200, { name: "موسوعة الدرر", service: "Dorar Hadith API Official", version: "0.8.0", locale, direction: locale.dir, endpoints: { health: "/health", locales: "/locales", search: "/search?q=...", quranAyah: "/quran/ayah?verse=1:1&translationIds=...&tafsirIds=...", quranTranslations: "/quran/translations?lang=en", sources: "/sources", books: "/books", authors: "/authors", categories: "/categories", maqasid: "/maqasid" }, source: "Dorar.net" });
  if (url.pathname === "/locales") return sendJson(res, 200, { default: DEFAULT_LOCALE, count: listLocales().length, locales: listLocales() });
  if (url.pathname === "/categories") return sendJson(res, 200, { locale, direction: locale.dir, categories: listCategories() });
  if (url.pathname === "/sources") return sendJson(res, 200, { locale, sources: listSources({ category: requireString(url.searchParams.get("category")), role: requireString(url.searchParams.get("role")) }) });
  if (url.pathname === "/sources/one") { const id = requireString(url.searchParams.get("id")); if (!id) return sendJson(res, 400, { error: "Missing required query parameter: id" }); const source = getSource(id); return source ? sendJson(res, 200, { locale, source }) : sendJson(res, 404, { error: "Source not found" }); }
  if (url.pathname === "/books") return sendJson(res, 200, { locale, books: listBooks({ subject: requireString(url.searchParams.get("subject")), madhhab: requireString(url.searchParams.get("madhhab")), authorId: requireString(url.searchParams.get("authorId")) }) });
  if (url.pathname === "/authors") return sendJson(res, 200, { locale, authors: listAuthors({ madhhab: requireString(url.searchParams.get("madhhab")) }) });
  if (url.pathname === "/maqasid") return sendJson(res, 200, { locale, maqasid: getMaqasid() });

  if (url.pathname === "/quran/translations") {
    try { return sendJson(res, 200, { locale, translations: await listQuranTranslations(requireString(url.searchParams.get("lang")) || locale.code) }); }
    catch (error) { return sendJson(res, 502, { error: error.message, locale }); }
  }

  if (url.pathname === "/quran/ayah") {
    const verse = requireString(url.searchParams.get("verse"));
    if (!verse) return sendJson(res, 400, { error: "Missing required query parameter: verse (e.g. 1:1)" });
    const translationIds = (url.searchParams.get("translationIds") || "").split(",").map(Number).filter(Number.isInteger).filter((n) => n > 0);
    const tafsirIds = (url.searchParams.get("tafsirIds") || "").split(",").map(Number).filter(Number.isInteger).filter((n) => n > 0);
    try {
      const data = await getQuranAyah({ verseKey: verse, translationIds, tafsirIds, language: locale.code, words: url.searchParams.get("words") === "true" });
      return data ? sendJson(res, 200, { locale, direction: locale.dir, data }) : sendJson(res, 404, { error: "Ayah not found" });
    } catch (error) {
      const status = error.code === "QF_NOT_CONFIGURED" ? 503 : 502;
      return sendJson(res, status, { error: error.message, locale, setup: status === 503 ? "Configure QF_CLIENT_ID and QF_CLIENT_SECRET on the server" : undefined });
    }
  }

  if (url.pathname === "/search") {
    const q = queryText;
    if (!q) return sendJson(res, 400, { error: "Missing required query parameter: q" });
    if (q.length > MAX_QUERY_LENGTH) return sendJson(res, 413, { error: `Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters` });
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const data = await unifiedSearch(q, { signal: controller.signal, includePotentialMatches: url.searchParams.get("includePotentialMatches") === "true" });
      return sendJson(res, 200, { ...data, locale, direction: locale.dir, languageDetection: { explicit: Boolean(requestedLanguage), detectedFromQuery: !requestedLanguage && Boolean(detectLocale(q)), selected: locale.code } });
    } catch (error) {
      return sendJson(res, 502, { error: error?.name === "AbortError" ? "Search request timed out" : "Unable to retrieve unified search results", source: "Dorar.net", locale });
    } finally { clearTimeout(timeout); }
  }
  return sendJson(res, 404, { error: "Not found" });
});
server.listen(PORT, HOST, () => console.log(`Dorar API listening on ${HOST}:${PORT}`));
