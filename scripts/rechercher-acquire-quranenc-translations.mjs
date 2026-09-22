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

async function getJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function getBinary(url) {
  const response = await fetch(url, { headers: { accept: "application/octet-stream,*/*" } });
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

const official = JSON.parse(JSON.stringify(await getJson(OFFICIAL_LIST)));
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

if (editions.length < 74) throw new Error(`Expected at least 74 live QuranEnc editions, found ${editions.length}`);

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(OUT, { recursive: true });

const editionResults = await mapLimit(editions, async (edition) => {
  const dir = path.join(OUT, "editions", edition.language_iso_code || "unknown", edition.edition_id);
  await fs.mkdir(dir, { recursive: true });

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
      const file = path.join(dir, `${edition.edition_id}${kind === "pdf" ? "" : `.${kind}`}${ext}`);
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
  await fs.writeFile(
    path.join(dir, "metadata.json"),
    JSON.stringify(metadata, null, 2) + "\n",
    "utf8"
  );
  return metadata;
}, 2);

const manifest = {
  schema_version: "2026-09-22",
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
  editions: editionResults
};
await fs.writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  edition_count: manifest.edition_count,
  acquired_editions: manifest.acquired_editions,
  not_acquired_editions: manifest.not_acquired_editions,
  language_count: manifest.language_count
}, null, 2));
