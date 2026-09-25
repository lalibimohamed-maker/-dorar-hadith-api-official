import fs from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve("config/quran-multisource-translation-catalog-2026-09-22.json");
const QURANENC = "https://quranenc.com/api/v1/translations/list";
const QF_BASE = process.env.QF_ENV === "production"
  ? "https://apis.quran.foundation/content/api/v4"
  : "https://apis-prelive.quran.foundation/content/api/v4";
const QF_AUTH = process.env.QF_ENV === "production"
  ? "https://oauth2.quran.foundation/oauth2/token"
  : "https://prelive-oauth2.quran.foundation/oauth2/token";

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { headers: { accept: "application/json", ...(options.headers || {}) }, ...options });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

async function quranFoundationTranslations() {
  if (!process.env.QF_CLIENT_ID || !process.env.QF_CLIENT_SECRET) {
    return { status: "credentials_not_configured", editions: [] };
  }
  const basic = Buffer.from(`${process.env.QF_CLIENT_ID}:${process.env.QF_CLIENT_SECRET}`).toString("base64");
  const tokenResponse = await fetchJson(QF_AUTH, {
    method: "POST",
    headers: { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=content",
  });
  const token = tokenResponse.access_token;
  const data = await fetchJson(`${QF_BASE}/resources/translations`, {
    headers: { "x-auth-token": token, "x-client-id": process.env.QF_CLIENT_ID },
  });
  const editions = Array.isArray(data.translations) ? data.translations : [];
  return {
    status: "live_api",
    editions: editions.map((x) => ({
      source_id: "quran-foundation",
      edition_id: String(x.id ?? x.resource_id ?? ""),
      language_iso_code: x.language_iso_code ?? x.language_code ?? null,
      language_name: x.language_name ?? null,
      resource_name: x.resource_name ?? x.name ?? null,
      author_name: x.author_name ?? null,
      publisher_or_institution: null,
      original_source_url: null,
      license_or_permission_evidence: null,
      text_integrity_status: "pending",
      primary_source_verification: "pending",
      rights_verification: "pending",
      matrix_eligibility: "blocked_pending_verification",
    })),
  };
}

// Re-serialize API JSON before any catalog file write so remote bytes are never
// persisted as a raw network response.
const quranEncPayload = JSON.parse(JSON.stringify(await fetchJson(QURANENC)));
if (!Array.isArray(quranEncPayload.translations)) {
  throw new Error("QuranEnc response does not contain translations[]");
}

const quranEnc = quranEncPayload.translations.map((x) => ({
  source_id: "quranenc",
  edition_id: x.key,
  language_iso_code: x.language_iso_code ?? null,
  language_name: null,
  resource_name: x.title ?? null,
  author_name: null,
  publisher_or_institution: null,
  api_description_claim: x.description ?? null,
  version: x.version ?? null,
  last_update: x.last_update ?? null,
  original_source_url: null,
  license_or_permission_evidence: null,
  text_integrity_status: "pending",
  primary_source_verification: "pending",
  rights_verification: "pending",
  matrix_eligibility: "blocked_pending_verification",
}));

const qf = await quranFoundationTranslations();

const catalog = {
  schema_version: "2026-09-22",
  layer: "System",
  purpose: "Unified discovery catalog for Quran translation editions; not a Corpus ingest manifest.",
  generated_at: new Date().toISOString(),
  policy: {
    canonical_arabic_separate: true,
    ai_generated_translation_forbidden: true,
    api_presence_is_not_primary_provenance: true,
    api_access_is_not_redistribution_rights: true,
    primary_source_verification_required: true,
    rights_verification_required: true,
    text_integrity_verification_required: true,
    matrix_admission_requires_all_verifications: true,
    corpus_write_forbidden: true,
  },
  sources: {
    quranenc: {
      status: "live_api",
      endpoint: QURANENC,
      edition_count: quranEnc.length,
    },
    quran_foundation: {
      status: qf.status,
      endpoint: `${QF_BASE}/resources/translations`,
      edition_count: qf.editions.length,
    },
    tanzil: {
      status: "registered_pending_catalog_sync",
      role: "discovery_and_provenance",
      edition_count: 0,
    },
    al_quran_cloud: {
      status: "registered_pending_catalog_sync",
      role: "aggregator; preserve original source provenance",
      edition_count: 0,
    },
    global_quran: {
      status: "registered_pending_catalog_sync",
      role: "aggregator; preserve original source provenance",
      edition_count: 0,
    },
    islamic_network: {
      status: "registered_pending_catalog_sync",
      role: "distribution/API candidate; not primary provenance by default",
      edition_count: 0,
    },
    mp3quran: {
      status: "registered_pending_catalog_sync",
      role: "audio/distribution source; translation metadata only where documented",
      edition_count: 0,
    },
    fawazahmed0_quran_api: {
      status: "registered_pending_catalog_sync",
      role: "aggregator/discovery; verify each embedded edition",
      edition_count: 0,
    },
  },
  editions: [...quranEnc, ...qf.editions],
  summary: {
    quranenc_live_editions: quranEnc.length,
    quran_foundation_live_editions: qf.editions.length,
    total_live_catalog_editions: quranEnc.length + qf.editions.length,
    unique_source_edition_keys: new Set([...quranEnc.map(x => `quranenc:${x.edition_id}`), ...qf.editions.map(x => `quran-foundation:${x.edition_id}`)]).size,
  },
};

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(catalog, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  output: OUT,
  quranenc_live_editions: quranEnc.length,
  quran_foundation_status: qf.status,
  quran_foundation_live_editions: qf.editions.length,
  total_live_catalog_editions: catalog.summary.total_live_catalog_editions,
}, null, 2));
