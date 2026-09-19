import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const registry = JSON.parse(await fs.readFile(path.join(ROOT, 'config/rechercher/global-multilingual-resource-discovery-2026.json'), 'utf8'));
const matrix = JSON.parse(await fs.readFile(path.join(ROOT, 'config/rechercher/global-multilingual-search-matrix-2026.json'), 'utf8'));
const expansion = JSON.parse(await fs.readFile(path.join(ROOT, 'config/rechercher/multilingual-resource-expansion-2026.json'), 'utf8'));

const args = new Map(process.argv.slice(2).map((arg) => {
  const [k, ...rest] = arg.replace(/^--/, '').split('=');
  return [k, rest.join('=') || true];
}));
const shardIndex = Number(args.get('shard-index') ?? 0);
const shardCount = Number(args.get('shard-count') ?? 1);
const outputDir = String(args.get('output-dir') ?? 'artifacts/rechercher/global-multilingual-research');
const contact = process.env.CROSSREF_MAILTO || 'rechercher-research@users.noreply.github.com';

if (!Number.isInteger(shardIndex) || !Number.isInteger(shardCount) || shardIndex < 0 || shardCount < 1 || shardIndex >= shardCount) {
  throw new Error(`Invalid shard ${shardIndex}/${shardCount}`);
}
if (registry.matrix.language_count !== 133 || registry.matrix.domain_count !== 24 || registry.matrix.expected_search_cells !== 3192) {
  throw new Error('Global matrix contract is not 133 x 24 x 3192');
}
if (registry.resource_lanes.length !== 24 || matrix.cell_pipeline.length !== 9 || expansion.resource_routes.length !== 9) {
  throw new Error('Resource lanes or nine-stage evidence pipeline changed unexpectedly');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const cache = new Map();

// Every outbound request is constrained to a fixed allowlist of research providers.
// This keeps registry-derived paths/query parameters from turning into arbitrary hosts.
const TRUSTED_ORIGINS = new Set([
  'https://quranenc.com',
  'https://hadeethenc.com',
  'https://api-docs.quran.foundation',
  'https://www.alislam.org',
  'https://tanzil.net',
  'https://islamhouse.com',
  'https://archive.org',
  'https://api.crossref.org'
]);

function trustedUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  if (!TRUSTED_ORIGINS.has(parsed.origin)) {
    throw new Error('Outbound evidence URL is not allowlisted: ' + parsed.origin);
  }
  return parsed.href;
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
function isoNow() { return new Date().toISOString(); }

async function fetchEvidence(url, {label, maxBytes = 262144, retries = 3} = {}) {
  const targetUrl = trustedUrl(url);
  if (cache.has(targetUrl)) return {...cache.get(targetUrl), cached: true};
  let lastError = null;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const started = Date.now();
    try {
      const res = await fetch(targetUrl, {
        redirect: 'follow',
        headers: {
          'accept': 'application/json,text/html;q=0.9,*/*;q=0.1',
          'user-agent': `DinAllah-Rechercher/1.0 (+${contact})`
        }
      });
      const bytes = Buffer.from(await res.arrayBuffer());
      const sample = bytes.subarray(0, maxBytes);
      const record = {
        label,
        url: targetUrl,
        final_url: res.url,
        http_status: res.status,
        ok: res.ok,
        content_type: res.headers.get('content-type') || null,
        bytes_observed: bytes.length,
        sha256_observed_prefix: sha256(sample),
        elapsed_ms: Date.now() - started,
        checked_at: isoNow()
      };
      cache.set(targetUrl, record);
      if (res.status === 429 || res.status >= 500) await sleep(1200 * (attempt + 1));
      return record;
    } catch (error) {
      lastError = error;
      await sleep(800 * (attempt + 1));
    }
  }
  const record = {label, url, http_status: null, ok: false, error: String(lastError?.message || lastError), checked_at: isoNow()};
  cache.set(targetUrl, record);
  return record;
}

const evidenceSources = Object.fromEntries(registry.evidence_sources.map((s) => [s.id, s]));
const expansionLanguages = Object.fromEntries(expansion.languages.map((s) => [s.name.toLowerCase(), s]));

const providerRoots = {
  quranenc: 'https://quranenc.com/en/',
  quran_foundation: 'https://api-docs.quran.foundation/',
  hadeethenc: 'https://hadeethenc.com/ar/',
  islamhouse: 'https://islamhouse.com/en/',
  alislam: 'https://www.alislam.org/',
  tanzil: 'https://tanzil.net/'
};

function languageRecord(name) {
  const hinted = expansionLanguages[name.toLowerCase()];
  return hinted ? {...hinted, name} : {name, iso: null, source: 'islamhouse', status: 'candidate'};
}

function primaryProvider(language) {
  if (evidenceSources[language.source]) return language.source;
  return 'islamhouse';
}

function sourceUrl(provider, iso) {
  if (provider === 'quranenc' && iso) return `https://quranenc.com/${encodeURIComponent(iso)}/`;
  if (provider === 'hadeethenc' && iso) return `https://hadeethenc.com/${encodeURIComponent(iso)}/`;
  return providerRoots[provider] || providerRoots.islamhouse;
}

function apiUrl(domain, iso) {
  if (domain === 'quran' && iso) return `https://quranenc.com/api/v1/translations/list/${encodeURIComponent(iso)}/?localization=en`;
  if (['hadith', 'hadith_explanation', 'sunnah'].includes(domain) && iso) return `https://hadeethenc.com/${encodeURIComponent(iso)}/`;
  if (domain === 'tafsir') return 'https://api-docs.quran.foundation/docs/content_apis_versioned/4.0.0/tafsirs/';
  return null;
}

function structuredUrl(domain, iso, provider) {
  if (provider === 'quranenc' && iso) return sourceUrl('quranenc', iso);
  if (provider === 'hadeethenc' && iso) return sourceUrl('hadeethenc', iso);
  if (domain === 'books' || domain === 'pdf') return providerRoots.islamhouse;
  return sourceUrl(provider, iso);
}

function corpusUrl(language, domain) {
  const lang = language.iso ? `${language.name} ${language.iso}` : language.name;
  const query = encodeURIComponent(`(${lang}) AND (${domain.replaceAll('_', ' ')})`);
  return `https://archive.org/advancedsearch.php?q=${query}&fl[]=identifier&fl[]=title&rows=1&page=1&output=json`;
}

function scholarlyUrl(language, domain) {
  const query = encodeURIComponent(`${language.name} Islamic ${domain.replaceAll('_', ' ')}`);
  return `https://api.crossref.org/works?query.bibliographic=${query}&rows=1&mailto=${encodeURIComponent(contact)}`;
}

function rightsUrl(provider, domain) {
  if (provider === 'quranenc') return 'https://quranenc.com/en/home/api';
  if (provider === 'hadeethenc') return 'https://hadeethenc.com/ar';
  if (provider === 'quran_foundation') return 'https://api-docs.quran.foundation/legal/developer-terms/';
  if (provider === 'alislam') return 'https://www.alislam.org/';
  if (provider === 'tanzil') return 'https://tanzil.net/docs/';
  if (domain === 'books' || domain === 'pdf') return 'https://archive.org/legal/terms.php';
  return providerRoots.islamhouse;
}

function evidenceStatus(record) {
  if (!record) return 'not-applicable';
  if (record.http_status === 429) return 'rate-limited';
  if (record.http_status === 401 || record.http_status === 403) return 'access-blocked';
  if (record.ok) return 'observed';
  if (record.http_status === 404) return 'not-found';
  return 'error';
}

function translationState(domain, apiRecord) {
  if (!['quran', 'hadith', 'hadith_explanation', 'sunnah'].includes(domain)) return 'not-applicable';
  return apiRecord?.ok ? 'source-verified' : 'translation-needed';
}

function verificationState(stages) {
  const observed = stages.filter((s) => s.status === 'observed').length;
  const rights = stages.find((s) => s.stage === 'rights');
  if (observed >= 5 && rights?.rights_status === 'known-terms') return 'verified-evidence-chain';
  if (observed >= 3) return 'partially-verified';
  return 'unverified';
}

const languages = registry.enumerated_islamhouse_languages.map(languageRecord);
const domains = registry.resource_lanes;
const allCells = languages.flatMap((language) => domains.map((domain) => ({language, domain})));
const cells = allCells.filter((_, index) => index % shardCount === shardIndex);

const startedAt = isoNow();
const rows = [];
let done = 0;

for (const {language, domain} of cells) {
  const provider = primaryProvider(language);
  const primary = await fetchEvidence(sourceUrl(provider, language.iso), {label: 'primary_or_institutional_source'});
  const apiTarget = apiUrl(domain, language.iso);
  const api = apiTarget ? await fetchEvidence(apiTarget, {label: 'official_api'}) : null;
  const corpus = await fetchEvidence(corpusUrl(language, domain), {label: 'digital_corpus'});
  const structured = await fetchEvidence(structuredUrl(domain, language.iso, provider), {label: 'structured_web'});
  const scholarly = await fetchEvidence(scholarlyUrl(language, domain), {label: 'scholarly_dataset', retries: 5});
  const translationMeta = api && ['quran', 'hadith', 'hadith_explanation', 'sunnah'].includes(domain) ? api : null;
  const rights = await fetchEvidence(rightsUrl(provider, domain), {label: 'rights'});

  const evidence = [primary, api, corpus, structured, scholarly, translationMeta, rights].filter(Boolean);
  const provenance = {
    cell_id: `islamhouse-133:${language.name}:${domain}`,
    language: language.name,
    language_iso: language.iso,
    domain,
    source_provider: provider,
    source_status: language.status,
    evidence_count: evidence.length,
    evidence_urls: [...new Set(evidence.map((e) => e.url))],
    observed_evidence_hashes: evidence.filter((e) => e.ok).map((e) => ({url: e.url, sha256_observed_prefix: e.sha256_observed_prefix})),
    generated_at: isoNow()
  };

  const stages = [
    {stage: 'primary_or_institutional_source', status: evidenceStatus(primary), evidence: primary},
    {stage: 'official_api', status: evidenceStatus(api), evidence: api},
    {stage: 'digital_corpus', status: evidenceStatus(corpus), evidence: corpus},
    {stage: 'structured_web', status: evidenceStatus(structured), evidence: structured},
    {stage: 'scholarly_dataset', status: evidenceStatus(scholarly), evidence: scholarly},
    {stage: 'translation_metadata', status: translationMeta ? evidenceStatus(translationMeta) : 'not-applicable', evidence: translationMeta},
    {stage: 'provenance', status: 'computed', provenance},
    {stage: 'rights', status: rights.ok ? 'observed' : evidenceStatus(rights), rights_status: (provider === 'quranenc' || provider === 'hadeethenc') && rights.ok ? 'known-terms' : 'review-required', evidence: rights},
    {stage: 'verification', status: 'computed'}
  ];
  stages.at(-1).verification_status = verificationState(stages);

  rows.push({
    schema: 'rechercher/global-multilingual-research-result/v1',
    cell_id: provenance.cell_id,
    language: language.name,
    language_iso: language.iso,
    domain,
    translation_state: translationState(domain, translationMeta),
    machine_translation_used: false,
    canonical_arabic_overwrite: false,
    provider,
    stages,
    final_verification: stages.at(-1).verification_status,
    checked_at: isoNow()
  });
  done += 1;
  if (done % 25 === 0) console.log(`RESEARCH_PROGRESS shard=${shardIndex}/${shardCount} completed=${done}/${cells.length}`);
}

await fs.mkdir(outputDir, {recursive: true});
const jsonlPath = path.join(outputDir, `shard-${shardIndex}.jsonl`);
await fs.writeFile(jsonlPath, rows.map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf8');

const verificationCounts = {};
const translationCounts = {};
for (const row of rows) {
  verificationCounts[row.final_verification] = (verificationCounts[row.final_verification] || 0) + 1;
  translationCounts[row.translation_state] = (translationCounts[row.translation_state] || 0) + 1;
}
const summary = {
  schema: 'rechercher/global-multilingual-research-summary/v1',
  generated_at: isoNow(),
  started_at: startedAt,
  shard_index: shardIndex,
  shard_count: shardCount,
  language_count: languages.length,
  domain_count: domains.length,
  expected_total_cells: allCells.length,
  expected_shard_cells: cells.length,
  actual_cells: rows.length,
  verification_counts: verificationCounts,
  translation_counts: translationCounts,
  canonical_arabic_overwrite_cells: rows.filter((r) => r.canonical_arabic_overwrite).length,
  machine_translation_cells: rows.filter((r) => r.machine_translation_used).length,
  result_file: jsonlPath
};
await fs.writeFile(path.join(outputDir, `summary-${shardIndex}.json`), JSON.stringify(summary, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(summary));
