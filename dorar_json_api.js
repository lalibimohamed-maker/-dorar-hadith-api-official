import http from "node:http";
import { URL } from "node:url";
import crypto from "node:crypto";
import { unifiedSearch } from "./src/unified-search.js";
import { getMaqasid, getSource, listCategories, listSources } from "./src/source-registry.js";
import { listAuthors, listBooks } from "./src/book-catalog.js";
import { DEFAULT_LOCALE, detectLocale, listLocales, localeFromRequest } from "./src/i18n.js";
import { getQuranAyah } from "./src/quran-ayah.js";
import { listQuranTranslations } from "./src/quran-translations.js";
import { getTajweedCurriculum, getTajweedLesson } from "./src/tajweed-curriculum.js";
import { calculateInheritance, supportedMadhahib } from "./src/inheritance-calculator.js";
import { getComplexFaraidCase, listComplexFaraidCases } from "./src/faraid-complex-cases.js";
import { buildFiqhResearchTemplate, getFiqhResearchFramework, listFiqhMadhahib, listFiqhResearchScholars, searchFiqhResearch } from "./src/fiqh-research.js";
import { getDomainResearchPolicy, getDomainScholarFramework, listKnowledgeDomains, searchDomainScholars } from "./src/domain-scholar-framework.js";
import { getHadithMethodology, listNarratorGrades, listChainPhenomena, listCoreRijalBooks, buildNarratorResearchProfile, compareNarratorJudgments } from "./src/hadith-narrator-methodology.js";
import { getQuranVideoConfig, validateVideoSelection, buildVideoBackgroundPrompt } from "./src/quran-video-engine.js";
import { getScientificSignsConfig, createScientificSignsProject } from "./src/quran-scientific-signs.js";
import { concept as resolveConceptCard } from "./src/corpus_api.js";

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";
const API_VERSION = "0.11.0";
const MAX_QUERY_LENGTH = Number(process.env.MAX_QUERY_LENGTH || 300);
const MAX_JSON_BODY_BYTES = Number(process.env.MAX_JSON_BODY_BYTES || 262_144);
const PUBLIC_WINDOW_MS = 60_000;
const DAILY_WINDOW_MS = 86_400_000;
const PUBLIC_MAX_PER_WINDOW = Number(process.env.PUBLIC_MAX_PER_MINUTE || 30);
const APP_MAX_PER_WINDOW = Number(process.env.APP_MAX_PER_MINUTE || 120);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 10_000);
const TRUST_PROXY_HEADERS = process.env.TRUST_PROXY_HEADERS === "true";
const CLEANUP_INTERVAL_MS = 15 * 60_000;
const BRAND_NAME = "موسوعة دينُ الله";

const appKeys = new Map();
try {
  const configured = JSON.parse(process.env.APP_KEYS_JSON || "[]");
  if (!Array.isArray(configured)) throw new Error("APP_KEYS_JSON must be an array");
  for (const item of configured) {
    if (!item?.name || !item?.keyHash) continue;
    const dailyLimit = Number(item.dailyLimit ?? 100000);
    if (!Number.isSafeInteger(dailyLimit) || dailyLimit <= 0) continue;
    appKeys.set(String(item.keyHash), {
      name: String(item.name).slice(0, 100),
      dailyLimit,
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
  if (TRUST_PROXY_HEADERS) {
    const forwarded = String(req.headers["x-forwarded-for"] || "").split(",").map((value) => value.trim()).filter(Boolean);
    if (forwarded.length > 0) return forwarded[0];
  }
  return req.socket.remoteAddress || "unknown";
}

function consume(id, max, windowMs) {
  if (!Number.isSafeInteger(max) || max <= 0) return false;
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

function secondsUntilUtcDayReset() {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 1000));
}

function cleanupCounters() {
  const now = Date.now();
  for (const [id, record] of counters) {
    const windowMs = id.startsWith("daily:") ? DAILY_WINDOW_MS : PUBLIC_WINDOW_MS;
    if (!record || now - record.started >= windowMs * 2) counters.delete(id);
  }
}
const cleanupTimer = setInterval(cleanupCounters, CLEANUP_INTERVAL_MS);
cleanupTimer.unref();

function sendJson(res, status, data, extraHeaders = {}) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,HEAD,OPTIONS,POST",
    "access-control-allow-headers": "content-type,x-api-key,accept-language",
    ...extraHeaders
  });
  res.end(JSON.stringify(data));
}

function requireString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function intParam(url, name) {
  const raw = url.searchParams.get(name);
  if (raw === null || raw.trim() === "") return 0;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`Invalid non-negative integer: ${name}`);
  return value;
}

function numberParam(url, name, fallback = 0) {
  const raw = url.searchParams.get(name);
  if (raw === null || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`Invalid non-negative number: ${name}`);
  return value;
}

async function readJsonBody(req) {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (!contentType.includes("application/json")) throw new TypeError("Content-Type must be application/json");
  const declaredLength = Number(req.headers["content-length"] || 0);
  if (declaredLength > MAX_JSON_BODY_BYTES) throw Object.assign(new Error("JSON request body too large"), { code: "BODY_TOO_LARGE" });

  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_JSON_BODY_BYTES) throw Object.assign(new Error("JSON request body too large"), { code: "BODY_TOO_LARGE" });
    chunks.push(chunk);
  }
  if (total === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON"), { code: "INVALID_JSON" });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,HEAD,OPTIONS,POST",
      "access-control-allow-headers": "content-type,x-api-key,accept-language"
    });
    return res.end();
  }

  const pathname = String(req.url || "/").split("?", 1)[0];
  const methodOverrides = new Map([
    ["/quran/video/config", new Set(["GET", "HEAD"])],
    ["/quran/video/validate", new Set(["POST"])],
    ["/quran/video/background", new Set(["POST"])],
    ["/quran/scientific-signs/config", new Set(["GET", "HEAD"])],
    ["/quran/scientific-signs/project", new Set(["POST"])],
    ["/concept", new Set(["GET", "HEAD"])]
  ]);
  const allowedMethods = methodOverrides.get(pathname) || new Set(["GET", "HEAD"]);

  if (!allowedMethods.has(req.method)) {
    res.setHeader("allow", [...allowedMethods].join(", "));
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const requestedLanguage = requireString(url.searchParams.get("lang"));
  const queryText = String(url.searchParams.get("q") || "").trim();
  const locale = requestedLanguage
    ? localeFromRequest(requestedLanguage)
    : (detectLocale(queryText) || localeFromRequest(req.headers["accept-language"] || DEFAULT_LOCALE));

  if (url.pathname === "/health") {
    return sendJson(res, 200, { ok: true, service: "deen-allah-encyclopedia-api", name: BRAND_NAME, version: API_VERSION, locale, timestamp: new Date().toISOString() });
  }

  const rawKey = String(req.headers["x-api-key"] || "").trim();
  const keyHash = rawKey ? hashKey(rawKey) : null;
  const app = keyHash ? appKeys.get(keyHash) : null;

  if (rawKey && (!app || !app.enabled)) {
    return sendJson(res, 401, { error: "Invalid or disabled API key" });
  }

  if (app) {
    const dailyId = `daily:${keyHash}:${new Date().toISOString().slice(0, 10)}`;
    if (!consume(dailyId, app.dailyLimit, DAILY_WINDOW_MS)) {
      return sendJson(res, 429, { error: "Daily API key limit exceeded", retryAfterSeconds: secondsUntilUtcDayReset() });
    }
    if (!consume(`app:${keyHash}`, APP_MAX_PER_WINDOW, PUBLIC_WINDOW_MS)) {
      return sendJson(res, 429, { error: "Rate limit exceeded", retryAfterSeconds: 60 });
    }
  } else if (!consume(`ip:${clientIp(req)}`, PUBLIC_MAX_PER_WINDOW, PUBLIC_WINDOW_MS)) {
    return sendJson(res, 429, { error: "Rate limit exceeded", retryAfterSeconds: 60 });
  }

  if (url.pathname === "/") {
    return sendJson(res, 200, {
      name: BRAND_NAME,
      nameEn: "Deen Allah Encyclopedia",
      service: "Deen Allah API",
      version: API_VERSION,
      locale,
      direction: locale.dir,
      endpoints: {
        health: "/health",
        locales: "/locales",
        search: "/search?q=...",
        concept: "/concept?term=...",
        quranAyah: "/quran/ayah?verse=1:1&translationIds=...&tafsirIds=...",
        quranTranslations: "/quran/translations?lang=en",
        quranVideoConfig: "/quran/video/config",
        quranVideoValidate: "/quran/video/validate",
        quranVideoBackground: "/quran/video/background",
        quranScientificSignsConfig: "/quran/scientific-signs/config",
        quranScientificSignsProject: "/quran/scientific-signs/project",
        sources: "/sources",
        books: "/books",
        authors: "/authors",
        categories: "/categories",
        maqasid: "/maqasid",
        tajweed: "/tajweed",
        tajweedLesson: "/tajweed/lesson?id=letters",
        fiqh: "/fiqh",
        fiqhResearch: "/fiqh/research?q=...",
        fiqhTemplate: "/fiqh/template?q=...",
        domains: "/research/domains",
        domain: "/research/domain?id=tafsir",
        scholars: "/research/scholars?q=...&domain=aqeedah",
        hadithMethodology: "/hadith/methodology",
        narratorGrades: "/hadith/narrator-grades",
        chainPhenomena: "/hadith/chain-phenomena",
        rijalBooks: "/hadith/rijal-books",
        narratorProfile: "/hadith/narrator/profile?name=...",
        narratorCompare: "/hadith/narrator/compare",
        inheritance: "/inheritance?estate=100000&sons=1&daughters=1&madhhab=hanbali",
        inheritanceMadhahib: "/inheritance/madhahib",
        inheritanceComplexCases: "/inheritance/complex-cases"
      }
    });
  }

  if (url.pathname === "/locales") return sendJson(res, 200, { default: DEFAULT_LOCALE, count: listLocales().length, locales: listLocales() });
  if (url.pathname === "/categories") return sendJson(res, 200, { locale, direction: locale.dir, categories: listCategories() });
  if (url.pathname === "/sources") return sendJson(res, 200, { locale, sources: listSources({ category: requireString(url.searchParams.get("category")), role: requireString(url.searchParams.get("role")), country: requireString(url.searchParams.get("country")) }) });
  if (url.pathname === "/sources/one") {
    const id = requireString(url.searchParams.get("id"));
    if (!id) return sendJson(res, 400, { error: "Missing required query parameter: id" });
    const source = getSource(id);
    return source ? sendJson(res, 200, { locale, source }) : sendJson(res, 404, { error: "Source not found" });
  }
  if (url.pathname === "/books") return sendJson(res, 200, { locale, books: listBooks({ subject: requireString(url.searchParams.get("subject")), madhhab: requireString(url.searchParams.get("madhhab")), authorId: requireString(url.searchParams.get("authorId")) }) });
  if (url.pathname === "/authors") return sendJson(res, 200, { locale, authors: listAuthors({ madhhab: requireString(url.searchParams.get("madhhab")) }) });
  if (url.pathname === "/maqasid") return sendJson(res, 200, { locale, maqasid: getMaqasid() });

  if (url.pathname === "/hadith/methodology") return sendJson(res, 200, { locale, methodology: getHadithMethodology() });
  if (url.pathname === "/hadith/narrator-grades") return sendJson(res, 200, { locale, grades: listNarratorGrades() });
  if (url.pathname === "/hadith/chain-phenomena") return sendJson(res, 200, { locale, phenomena: listChainPhenomena() });
  if (url.pathname === "/hadith/rijal-books") return sendJson(res, 200, { locale, books: listCoreRijalBooks() });
  if (url.pathname === "/hadith/narrator/profile") {
    const name = requireString(url.searchParams.get("name"));
    if (!name) return sendJson(res, 400, { error: "Missing required query parameter: name" });
    return sendJson(res, 200, { locale, profile: buildNarratorResearchProfile({ name }) });
  }
  if (url.pathname === "/hadith/narrator/compare") {
    const rawJudgments = url.searchParams.get("judgments") || "[]";
    if (rawJudgments.length > MAX_JSON_BODY_BYTES) return sendJson(res, 413, { error: "judgments payload exceeds maximum size" });
    let judgments = [];
    try {
      judgments = JSON.parse(rawJudgments);
      if (!Array.isArray(judgments)) throw new Error("judgments must be an array");
    } catch {
      return sendJson(res, 400, { error: "judgments must be valid JSON array" });
    }
    return sendJson(res, 200, { locale, comparison: compareNarratorJudgments(judgments) });
  }

  if (url.pathname === "/research/domains") return sendJson(res, 200, { locale, domains: listKnowledgeDomains(), policy: getDomainResearchPolicy() });
  if (url.pathname === "/research/domain") {
    const id = requireString(url.searchParams.get("id"));
    if (!id) return sendJson(res, 400, { error: "Missing required query parameter: id" });
    const domain = getDomainScholarFramework(id);
    return domain ? sendJson(res, 200, { locale, domain }) : sendJson(res, 404, { error: "Research domain not found" });
  }
  if (url.pathname === "/research/scholars") return sendJson(res, 200, { locale, scholars: searchDomainScholars(requireString(url.searchParams.get("q")), requireString(url.searchParams.get("domain"))) });

  if (url.pathname === "/tajweed") return sendJson(res, 200, { locale, curriculum: getTajweedCurriculum() });
  if (url.pathname === "/tajweed/lesson") {
    const id = requireString(url.searchParams.get("id"));
    if (!id) return sendJson(res, 400, { error: "Missing required query parameter: id" });
    const lesson = getTajweedLesson(id);
    return lesson ? sendJson(res, 200, { locale, lesson }) : sendJson(res, 404, { error: "Tajweed lesson not found" });
  }

  if (url.pathname === "/fiqh") return sendJson(res, 200, { locale, framework: getFiqhResearchFramework(), madhahib: listFiqhMadhahib(), scholars: listFiqhResearchScholars({ query: requireString(url.searchParams.get("scholar")) }) });
  if (url.pathname === "/fiqh/research") {
    const q = requireString(url.searchParams.get("q"));
    if (!q) return sendJson(res, 400, { error: "Missing required query parameter: q" });
    if (q.length > MAX_QUERY_LENGTH) return sendJson(res, 413, { error: `Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters` });
    return sendJson(res, 200, { locale, query: q, results: searchFiqhResearch(q), method: getFiqhResearchFramework().analysisSchema });
  }
  if (url.pathname === "/fiqh/template") {
    const q = requireString(url.searchParams.get("q"));
    if (!q) return sendJson(res, 400, { error: "Missing required query parameter: q" });
    if (q.length > MAX_QUERY_LENGTH) return sendJson(res, 413, { error: `Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters` });
    return sendJson(res, 200, { locale, template: buildFiqhResearchTemplate(q, { madhhab: requireString(url.searchParams.get("madhhab")) }) });
  }

  if (url.pathname === "/inheritance/madhahib") return sendJson(res, 200, { locale, madhahib: supportedMadhahib(), noteAr: "المذاهب الأربعة هنا هي خيارات لإطار الحساب؛ المسائل التفصيلية قد تختلف باختلاف المذهب والحالة." });
  if (url.pathname === "/inheritance/complex-cases") {
    const id = requireString(url.searchParams.get("id"));
    if (id) {
      const item = getComplexFaraidCase(id);
      return item ? sendJson(res, 200, { locale, case: item }) : sendJson(res, 404, { error: "Complex faraid case not found", locale });
    }
    return sendJson(res, 200, { locale, cases: listComplexFaraidCases({ status: requireString(url.searchParams.get("status")), topic: requireString(url.searchParams.get("topic")) }) });
  }
  if (url.pathname === "/inheritance") {
    try {
      const data = calculateInheritance({
        madhhab: requireString(url.searchParams.get("madhhab")) || "hanbali",
        estate: numberParam(url, "estate"),
        debts: numberParam(url, "debts"),
        bequest: numberParam(url, "bequest"),
        heirs: {
          husband: intParam(url, "husband"),
          wives: intParam(url, "wives"),
          father: intParam(url, "father"),
          mother: intParam(url, "mother"),
          grandfather: intParam(url, "grandfather"),
          grandmothers: intParam(url, "grandmothers"),
          sons: intParam(url, "sons"),
          daughters: intParam(url, "daughters"),
          grandsons: intParam(url, "grandsons"),
          granddaughters: intParam(url, "granddaughters"),
          fullBrothers: intParam(url, "fullBrothers"),
          fullSisters: intParam(url, "fullSisters"),
          paternalBrothers: intParam(url, "paternalBrothers"),
          paternalSisters: intParam(url, "paternalSisters"),
          maternalBrothers: intParam(url, "maternalBrothers"),
          maternalSisters: intParam(url, "maternalSisters")
        }
      });
      return sendJson(res, 200, { locale, direction: locale.dir, data });
    } catch (error) {
      return sendJson(res, 400, { error: error.message, locale });
    }
  }

  if (url.pathname === "/quran/translations") {
    try {
      return sendJson(res, 200, { locale, translations: await listQuranTranslations(requireString(url.searchParams.get("lang")) || locale.code) });
    } catch (error) {
      return sendJson(res, 502, { error: error.message, locale });
    }
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

  if (url.pathname === "/quran/video/config") {
    return sendJson(res, 200, { locale, config: getQuranVideoConfig() });
  }

  if (url.pathname === "/quran/video/validate") {
    try {
      const body = await readJsonBody(req);
      const data = validateVideoSelection(body);
      return sendJson(res, 200, { locale, data });
    } catch (error) {
      const status = error.code === "BODY_TOO_LARGE" ? 413 : 400;
      return sendJson(res, status, { error: error.message, locale });
    }
  }

  if (url.pathname === "/quran/video/background") {
    try {
      const body = await readJsonBody(req);
      const data = buildVideoBackgroundPrompt(body.prompt, body.preset);
      return sendJson(res, 200, { locale, data });
    } catch (error) {
      const status = error.code === "BODY_TOO_LARGE" ? 413 : 400;
      return sendJson(res, status, { error: error.message, locale });
    }
  }

  if (url.pathname === "/quran/scientific-signs/config") {
    return sendJson(res, 200, { locale, config: getScientificSignsConfig() });
  }

  if (url.pathname === "/quran/scientific-signs/project") {
    try {
      const body = await readJsonBody(req);
      const data = createScientificSignsProject(body);
      return sendJson(res, 200, { locale, data });
    } catch (error) {
      const status = ["BODY_TOO_LARGE", "INVALID_JSON"].includes(error.code) ? 413 : 400;
      return sendJson(res, status, { error: error.message, locale });
    }
  }

  if (url.pathname === "/concept") {
    const term = requireString(url.searchParams.get("term"));
    if (!term) return sendJson(res, 400, { error: "Missing required query parameter: term" });
    if (term.length > MAX_QUERY_LENGTH) return sendJson(res, 413, { error: `Term exceeds maximum length of ${MAX_QUERY_LENGTH} characters` });
    try {
      const contextId = requireString(url.searchParams.get("context"));
      const comparative = url.searchParams.get("comparative") === "true";
      const data = resolveConceptCard(term, contextId, locale.code, { comparative });
      return sendJson(res, 200, { locale, direction: locale.dir, data });
    } catch (error) {
      return sendJson(res, 502, { error: "Unable to resolve concept card", source: "concept-resolver", locale });
    }
  }

  if (url.pathname === "/search") {
    const q = queryText;
    if (!q) return sendJson(res, 400, { error: "Missing required query parameter: q" });
    if (q.length > MAX_QUERY_LENGTH) return sendJson(res, 413, { error: `Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters` });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const data = await unifiedSearch(q, {
        signal: controller.signal,
        responseLocale: locale.code,
        includePotentialMatches: url.searchParams.get("includePotentialMatches") === "true"
      });
      return sendJson(res, 200, {
        ...data,
        locale,
        direction: locale.dir,
        languageDetection: {
          explicit: Boolean(requestedLanguage),
          detectedFromQuery: !requestedLanguage && Boolean(detectLocale(q)),
          selected: locale.code
        }
      });
    } catch (error) {
      return sendJson(res, 502, { error: error?.name === "AbortError" ? "Search request timed out" : "Unable to retrieve unified search results", source: "unified-search", locale });
    } finally {
      clearTimeout(timeout);
    }
  }

  return sendJson(res, 404, { error: "Not found" });
});

server.keepAliveTimeout = 65_000;
server.headersTimeout = 70_000;
server.requestTimeout = 30_000;

server.listen(PORT, HOST, () => {
  const address = server.address();
  const boundPort = typeof address === "object" && address ? address.port : PORT;
  console.log(`Deen Allah API ${API_VERSION} listening on ${HOST}:${boundPort}`);
});
