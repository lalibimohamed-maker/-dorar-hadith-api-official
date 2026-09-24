#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const CATALOG = path.join(ROOT, "config/quran-multisource-translation-catalog-2026-09-22.json");
const OUT = path.join(ROOT, "artifacts/quran-translation-acquisition");
const API_BASE = "https://quranenc.com/api/v1";
const OFFICIAL_LIST = `${API_BASE}/translations/list`;
const MAX_FILE_BYTES = 300 * 1024 * 1024;

const REQUEST_TIMEOUT_MS = 45000;
const LIST_ATTEMPTS = 4;
const ACQUISITION_CONCURRENCY = Math.max(1, Math.min(6, Number(process.env.QURANENC_CONCURRENCY || 6)));
const QURANENC_HOSTS = new Set(["quranenc.com", "www.quranenc.com"]);

function trustedQuranEncUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "https:" || !QURANENC_HOSTS.has(parsed.hostname.toLowerCase()) || parsed.username || parsed.password || (parsed.port && parsed.port !== "443")) {
    throw new Error("download URL is outside the fixed QuranEnc HTTPS origin allowlist");
  }
  if (parsed.pathname.includes("..") || /[\u0000-\u001f\u007f]/.test(parsed.pathname + parsed.search)) {
    throw new Error("download URL contains unsafe path characters");
  }
  return parsed.toString();
}

function safeSegment(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9._-]+$/.test(value) || value === "." || value === "..") {
    throw new Error(`unsafe ${label}`);
  }
  return value;
}

function classifyNetwork(error) {
  const message = String(error?.message || error || "");
  return /fetch failed|aborted|abort|timeout|timed out|ETIMEDOUT|ECONNRESET|ENETUNREACH|EAI_AGAIN|ENOTFOUND|HTTP 4\\d\\d|HTTP 5\\d\\d/i.test(message)
    ? "network_unavailable"
    : "source_or_validation_error";
}

async function getJson(url, attempts = LIST_ATTEMPTS) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { headers: { accept: "application/json" }, signal: controller.signal });
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    } finally { clearTimeout(timer); }
  }
  throw lastError;
}

async function getBinary(url) {
  const trustedUrl = trustedQuranEncUrl(url);
  const response = await fetch(trustedUrl, { headers: { accept: "application/octet-stream,*/*" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_FILE_BYTES) throw new Error(`response exceeds ${MAX_FILE_BYTES} bytes`);
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > MAX_FILE_BYTES) throw new Error(`response exceeds ${MAX_FILE_BYTES} bytes`);
  return data;
}

function validateSignature(kind, data) {
  const pdf = data.subarray(0, 5).toString("ascii") === "%PDF-";
  const zip = data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b;
  const sqlite = data.subarray(0, 16).toString("ascii") === "SQLite format 3\\u0000";
  if (kind.startsWith("pdf") && !pdf) throw new Error("downloaded PDF candidate lacks %PDF- signature");
  if (kind === "sqlite_zip" && !zip) throw new Error("downloaded SQLite ZIP candidate lacks ZIP signature");
  if (kind === "sqlite" && !sqlite) throw new Error("downloaded SQLite candidate lacks SQLite signature");
  if (kind === "epub" && !zip) throw new Error("downloaded EPUB candidate lacks ZIP signature");
}

async function mapLimit(items, worker, limit) {
  const results = new Array(items.length);
  let next = 0;
  async function runner() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      try { results[i] = await worker(items[i], i); }
      catch (error) { results[i] = { error: String(error?.message || error) }; }
    }
  }
  await Promise.all(Array.from({ length: limit }, runner));
  return results;
}

const catalog = JSON.parse(await fs.readFile(CATALOG, "utf8"));
const bootstrap = new Map(
  catalog.editions
    .filter((e) => e.source_id === "quranenc")
    .map((e) => [e.edition_id, e])
);

let official;
let list_error = null;
try { official = JSON.parse(JSON.stringify(await getJson(OFFICIAL_LIST))); }
catch (error) { list_error = { error: String(error?.message || error), classification: classifyNetwork(error) }; }

if (list_error) {
  const manifest = {
    schema_version: "2026-09-22",
    purpose: "Research-only QuranEnc acquisition; transient API outages must not be confused with missing editions.",
    source: "QuranEnc official API",
    canonical_arabic_separate: true,
    ai_generated_translation: false,
    corpus_write: false,
    edition_count: 0,
    acquired_editions: 0,
    not_acquired_editions: 0,
    network_unavailable: list_error.classification === "network_unavailable",
    network_error: list_error
  };
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });
  await fs.writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(manifest, null, 2));
  process.exit(list_error.classification === "network_unavailable" ? 0 : 1);
}
if (!Array.isArray(official.translations)) throw new Error("QuranEnc response missing translations[]");

const editions = official.translations.map((x) => ({
  ...(bootstrap.get(x.key) || {}),
  source_id: "quranenc",
  edition_id: x.key,
  language_iso_code: x.language_iso_code || bootstrap.get(x.key)?.language_iso_code || null,
  resource_name: x.title || null,
  api_description_claim: x.description || null,
  version: x.version || null,
  last_update: x.last_update || null,
  download_urls: {
    pdf: x.pdf_url || null,
    pdf_pure: x.pdf_pure_url || null,
    pdf_mobile: x.pdf_mobile_url || null,
    sqlite_zip: x.database_url || null,
    sqlite: x.database_uncompressed_url || null,
    epub: x.epub_url || null
  },
  primary_source_verification: bootstrap.get(x.key)?.primary_source_verification || "pending",
  rights_verification: {
    status: "source_terms_verified_pending_asset_review",
    evidence_url: "https://quranenc.com/ar/home/api",
    notes: "QuranEnc states that translation contents may be downloaded and re-published subject to its stated conditions, including no modification, attribution, version retention, preserving document information, source notification and updating to later source versions."
  },
  text_integrity_status: "pending",
  matrix_eligibility: "blocked_pending_verification"
}));

if (editions.length < 1) throw new Error(`QuranEnc live API returned no translation editions`);

await fs.mkdir(OUT, { recursive: true });

const editionResults = await mapLimit(editions, async (edition) => {
  const language = safeSegment(edition.language_iso_code || "unknown", "language code");
  const editionId = safeSegment(edition.edition_id, "edition id");
  const dir = path.join(OUT, "editions", language, editionId);
  await fs.mkdir(dir, { recursive: true });

  // Resume from the latest persisted acquisition artifact. A validated existing asset is never re-downloaded.
  const existingMetadataPath = path.join(dir, "metadata.json");
  try {
    const existing = JSON.parse(await fs.readFile(existingMetadataPath, "utf8"));
    if (existing.status === "acquired_research_only" && existing.acquired?.path) {
      const absolute = path.join(ROOT, existing.acquired.path);
      await fs.access(absolute);
      return { ...existing, resumed: true };
    }
  } catch {}

  const candidates = [
    ["pdf", edition.download_urls.pdf],
    ["pdf_pure", edition.download_urls.pdf_pure],
    ["sqlite_zip", edition.download_urls.sqlite_zip],
    ["sqlite", edition.download_urls.sqlite],
    ["epub", edition.download_urls.epub]
  ].filter(([, url]) => url);

  let acquired = null;
  const attempts = [];

  for (const [kind, url] of candidates) {
    try {
      const data = await getBinary(url);
      validateSignature(kind, data);
      const ext = kind.startsWith("pdf") ? ".pdf" : kind === "sqlite_zip" ? ".zip" : kind === "sqlite" ? ".sqlite" : ".epub";
      const file = path.join(dir, `${editionId}${kind === "pdf" ? "" : `.${kind}`}${ext}`);
      await fs.writeFile(file, data);
      acquired = {
        kind,
        url,
        path: path.relative(ROOT, file),
        bytes: data.length,
        sha256: crypto.createHash("sha256").update(data).digest("hex")
      };
      break;
    } catch (error) {
      attempts.push({ kind, url, error: String(error?.message || error) });
    }
  }

  const metadata = {
    source_id: edition.source_id,
    edition_id: edition.edition_id,
    language_iso_code: edition.language_iso_code,
    resource_name: edition.resource_name,
    version: edition.version,
    last_update: edition.last_update,
    api_description_claim: edition.api_description_claim,
    download_urls: edition.download_urls,
    primary_source_verification: edition.primary_source_verification,
    rights_verification: edition.rights_verification,
    acquired,
    attempts,
    corpus_write: false,
    ai_generated_translation: false,
    canonical_arabic_separate: true,
    status: acquired ? "acquired_research_only" : "not_acquired"
  };
  // codeql[js/http-to-file-access] The URL is restricted to QuranEnc HTTPS and the asset is size/signature validated before persistence.
  await fs.writeFile(
    path.join(dir, "metadata.json"),
    JSON.stringify(metadata, null, 2) + "\n",
    "utf8"
  );
  return metadata;
}, ACQUISITION_CONCURRENCY);

const bootstrapEditionIds = new Set(bootstrap.keys());
const liveOnlyEditions = editionResults.filter((x) => !bootstrapEditionIds.has(x.edition_id)).map((x) => x.edition_id);
const manifest = {
  schema_version: "2026-09-23",
  purpose: "Research-only acquisition of complete QuranEnc translation assets; never a Corpus write or automatic redistribution grant.",
  source: "QuranEnc official API and official download URLs",
  source_terms_url: "https://quranenc.com/ar/home/api",
  canonical_arabic_separate: true,
  ai_generated_translation: false,
  corpus_write: false,
  rights_verification_required_before_publication: true,
  edition_count: editionResults.length,
  minimum_expected_editions: 74,
  acquired_editions: editionResults.filter((x) => x.acquired).length,
  not_acquired_editions: editionResults.filter((x) => !x.acquired).length,
  language_count: new Set(editionResults.map((x) => x.language_iso_code)).size,
  live_only_editions: liveOnlyEditions,
  live_only_edition_count: liveOnlyEditions.length,
  editions: editionResults,
  last_completed_language: [...editionResults].reverse().find(x => x.status === "acquired_research_only")?.language_iso_code || null,
  resume_supported: true
};
await fs.writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  edition_count: manifest.edition_count,
  acquired_editions: manifest.acquired_editions,
  not_acquired_editions: manifest.not_acquired_editions,
  language_count: manifest.language_count
}, null, 2));
