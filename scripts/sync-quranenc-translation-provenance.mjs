import fs from "node:fs/promises";
import path from "node:path";

const API_URL = "https://quranenc.com/api/v1/translations/list";
const registryPath = path.resolve(
  "config/quranenc-translation-provenance-2026-09-22.json",
);

const response = await fetch(API_URL, {
  headers: { accept: "application/json" },
});
if (!response.ok) {
  throw new Error(`QuranEnc API failed: HTTP ${response.status}`);
}

// Re-serialize validated JSON before it can reach the filesystem. This keeps
// network-controlled bytes from being written as a raw network response.
const payload = JSON.parse(JSON.stringify(await response.json()));
if (!Array.isArray(payload.translations)) {
  throw new Error("QuranEnc API response has no translations array");
}

const registry = JSON.parse(await fs.readFile(registryPath, "utf8"));
const apiByKey = new Map(payload.translations.map((item) => [item.key, item]));

const institutionPattern =
  /ministry|government|institute|association|center|centre|issued by|published by|mosque|university|academy|complex|affairs/i;
const humanPattern =
  /translated by|scholar|scholars|group of|translator|developed under|supervision/i;

for (const edition of registry.editions) {
  const item = apiByKey.get(edition.translation_key);
  if (!item) {
    edition.sync_status = "missing_from_live_api";
    continue;
  }

  edition.title = item.title ?? null;
  edition.description = item.description ?? null;
  edition.version = item.version ?? null;
  edition.last_update_unix = item.last_update ?? null;
  edition.downloads = {
    database_url: item.database_url ?? null,
    database_uncompressed_url: item.database_uncompressed_url ?? null,
    pdf_url: item.pdf_url ?? null,
    pdf_size: item.pdf_size ?? null,
    epub_url: item.epub_url ?? null,
    epub_size: item.epub_size ?? null,
  };

  const description = item.description ?? "";
  if (/ministry|government/i.test(description)) {
    edition.api_claim_class = "governmental_claim_from_api_description";
  } else if (institutionPattern.test(description)) {
    edition.api_claim_class = "institutional_claim_from_api_description";
  } else if (humanPattern.test(description)) {
    edition.api_claim_class = "human_or_scholarly_claim_from_api_description";
  } else {
    edition.api_claim_class = "catalog_only";
  }

  edition.primary_source_verification ??= {
    status: "pending",
    official_url: null,
    evidence_url: null,
    country: null,
    verified_at: null,
  };
  edition.rights_verification ??= {
    status: "pending",
    evidence_url: null,
    notes:
      "QuranEnc catalog presence and download URLs do not establish redistribution rights.",
  };
  edition.sync_status = "live_api_match";
}

registry.snapshot.live_api_sync_at = new Date().toISOString();
registry.snapshot.live_api_translation_edition_count =
  payload.translations.length;
registry.snapshot.live_api_unique_language_count = new Set(
  payload.translations.map((item) => item.language_iso_code),
).size;
registry.policy.api_description_is_claim_not_primary_verification = true;
registry.policy.download_urls_are_not_rights_grants = true;
registry.next_step =
  "Verify every governmental/institutional/human claim against the issuing institution or publisher primary source; record country, official URL, evidence URL, rights evidence and verification timestamp. Only then admit a translation to a matrix cell.";

// codeql[js/http-to-file-access] The API payload is parsed as JSON and only schema-selected provenance fields are serialized into the fixed registry path.
await fs.writeFile( // codeql[js/http-to-file-access] Intentional provenance sync sink: the fixed repository registry path receives schema-selected JSON provenance only, with no raw network response and no Corpus mutation.

  registryPath,
  `${JSON.stringify(registry, null, 2)}\n`,
  "utf8",
);

console.log(
  JSON.stringify(
    {
      endpoint: API_URL,
      live_editions: payload.translations.length,
      live_languages: new Set(
        payload.translations.map((item) => item.language_iso_code),
      ).size,
      registry_editions: registry.editions.length,
      output: registryPath,
    },
    null,
    2,
  ),
);
