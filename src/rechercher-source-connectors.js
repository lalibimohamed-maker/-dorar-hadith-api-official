const ISLAMHOUSE_BASE = "https://api3.islamhouse.com";
const GALLICA_SRU = "https://gallica.bnf.fr/services/engine/search/sru";

const IIIF_PROVIDERS = Object.freeze({
  "british-library": ["https://bl.digirati.io", "https://iiif.bl.uk"],
  qdl: ["https://www.qdl.qa", "https://iiif.qdl.qa"],
  princeton: ["https://figgy.princeton.edu"],
  vhmml: ["https://www.vhmml.org"],
  "gallica-bnf": ["https://gallica.bnf.fr"],
  "leiden-collections": ["https://digitalcollections.universiteitleiden.nl"],
  cambridge: ["https://cudl.lib.cam.ac.uk"],
  "al-furqan": ["https://digitallibrary.al-furqan.com"]
});

function required(value, name) {
  if (value === undefined || value === null || value === "") throw new TypeError(name + " is required");
  return String(value);
}

async function jsonGet(url, options = {}) {
  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json", "user-agent": "DinAllah-Rechercher/1.0" },
    redirect: "error",
    ...options
  });
  if (!response.ok) throw new Error(`Source connector returned HTTP ${response.status}`);
  return response.json();
}

function islamHouseUrl(pathParts) {
  return ISLAMHOUSE_BASE + "/" + pathParts.map((part) => encodeURIComponent(String(part))).join("/") + "/json";
}

export function islamHouseConnectorInfo() {
  return { id: "islamhouse", runtime: "public-api-v3", baseUrl: ISLAMHOUSE_BASE, source: "IslamHouse", rightsGate: "required-per-item", corpusWrite: "never-direct" };
}

export function islamHouseCategories(language = "ar") {
  return jsonGet(islamHouseUrl(["main", "get-categories-tree", required(language, "language")]));
}

export function islamHouseCategoryItems({ categoryId, language = "ar", type = "showall", page = 1, perPage = 20 } = {}) {
  return jsonGet(islamHouseUrl(["main", "get-category-items", required(categoryId, "categoryId"), type, required(language, "language"), type, page, perPage]));
}

export function islamHouseItem(itemId, language = "ar") {
  return jsonGet(islamHouseUrl(["main", "get-item", required(itemId, "itemId"), required(language, "language")]));
}

export function islamHouseItemTranslations(itemId, language = "ar") {
  return jsonGet(islamHouseUrl(["main", "get-item-translations", required(itemId, "itemId"), required(language, "language")]));
}

export function islamHouseAvailableLanguages(contentType = "quran", language = "ar") {
  return jsonGet(islamHouseUrl(["main", "get-available-languages", contentType, required(language, "language")]));
}

export function islamHouseLatest({ type = "showall", language = "ar", sourceLanguage = "ar", count = 8 } = {}) {
  return jsonGet(islamHouseUrl(["main", "latestupdated", type, required(language, "language"), sourceLanguage, count]));
}

export function islamHouseBooks({ language = "ar", sourceLanguage = "ar", page = 1, perPage = 20 } = {}) {
  return jsonGet(islamHouseUrl(["main", "books", required(language, "language"), sourceLanguage, page, perPage]));
}

export function gallicaSearch({ query, maximumRecords = 20, startRecord = 1 } = {}) {
  const q = required(query, "query");
  const url = new URL(GALLICA_SRU);
  url.searchParams.set("operation", "searchRetrieve");
  url.searchParams.set("version", "1.2");
  url.searchParams.set("query", `dc.title all "${q.replaceAll('"', " ")}"`);
  url.searchParams.set("maximumRecords", String(maximumRecords));
  url.searchParams.set("startRecord", String(startRecord));
  url.searchParams.set("collapsing", "true");
  url.searchParams.set("format", "json");
  return jsonGet(url);
}

function trustedIiifOrigin(provider, url) {
  const origins = IIIF_PROVIDERS[provider];
  if (!origins) throw new Error(`Unknown IIIF provider: ${provider}`);
  const parsed = new URL(url);
  if (!origins.includes(parsed.origin)) throw new Error(`IIIF URL origin is not allowlisted for ${provider}`);
  return parsed;
}

export function iiifManifestUrl(provider, url) {
  return trustedIiifOrigin(provider, required(url, "url")).toString();
}

export async function fetchIiifManifest(provider, url, { signal } = {}) {
  return jsonGet(iiifManifestUrl(provider, url), { signal });
}

export function iiifConnectorInfo() {
  return Object.fromEntries(Object.entries(IIIF_PROVIDERS).map(([id, origins]) => [
    id, { id, runtime: "iiif-manifest", origins: [...origins], rightsGate: "required-per-item", corpusWrite: "never-direct" }
  ]));
}

export function sourceConnectorHealth() {
  return {
    islamhouse: { runtime: "public-api-v3", configured: true },
    "gallica-bnf": { runtime: "sru-search", configured: true },
    "iiif-manifest": { runtime: "allowlisted-manifest-fetch", providers: Object.keys(IIIF_PROVIDERS).length }
  };
}
