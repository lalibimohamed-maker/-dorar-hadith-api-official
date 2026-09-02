/**
 * @Rechercher — Global Search Analysts.
 *
 * Pipeline: Discovery -> Bibliographic identity -> Rights -> Access ->
 * Provenance -> Acquisition ranking.
 *
 * Providers that require credentials are represented but skipped unless their
 * required environment variable is present. Discovery alone never authorizes
 * redistribution.
 */
import { buildSearchRecord, RIGHTS_DECISIONS } from './rechercher-rights-engine.js';

export const GLOBAL_PROVIDERS = Object.freeze({
  INTERNET_ARCHIVE: 'internet-archive',
  OPEN_LIBRARY: 'open-library',
  GOOGLE_BOOKS: 'google-books',
  EUROPEANA: 'europeana',
  GALLICA: 'gallica',
  DPLA: 'dpla',
  WORLDCAT: 'worldcat',
  QATAR_DIGITAL_LIBRARY: 'qatar-digital-library'
});

export const GLOBAL_OUTCOMES = Object.freeze({
  ALTERNATIVE_FOUND: 'alternative-found',
  READ_ONLY_ORIGINAL: 'read-only-original',
  NEEDS_DISCOVERY: 'needs-discovery',
  NEEDS_CREDENTIALS: 'needs-credentials'
});

const MAX_RESULTS_PER_PROVIDER = 10;
const DPLA_RIGHTS_REUSE = new Set([
  'http://rightsstatements.org/vocab/NoC-US/1.0/',
  'http://rightsstatements.org/vocab/NoC-OKLR/1.0/',
  'http://rightsstatements.org/vocab/NoC-NC/1.0/',
  'http://creativecommons.org/publicdomain/mark/1.0/',
  'http://creativecommons.org/publicdomain/zero/1.0/'
]);

function normalize(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '').replace(/[إأآٱ]/g, 'ا')
    .replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim().replace(/\s+/g, ' ');
}

function overlap(a, b) {
  const aa = new Set(normalize(a).split(' ').filter(Boolean));
  const bb = new Set(normalize(b).split(' ').filter(Boolean));
  if (!aa.size || !bb.size) return 0;
  let hits = 0;
  for (const t of aa) if (bb.has(t)) hits++;
  return hits / Math.max(aa.size, bb.size);
}

function searchQuery(record) {
  return [record?.title, record?.author].filter(Boolean).join(' ');
}

function isExplicitOpenRights(text) {
  const value = String(text ?? '').toLowerCase();
  return /(public domain|public-domain|creative commons|cc0|cc by|no rights reserved|permission to redistribute|open access)/i.test(value);
}

function normalizeDoc(provider, doc, record) {
  const title = doc.title ?? null;
  const author = Array.isArray(doc.creator) ? doc.creator[0] : (doc.creator ?? null);
  return {
    provider,
    sourceUrl: doc.sourceUrl,
    downloadUrl: doc.downloadUrl ?? null,
    title,
    author,
    publisher: doc.publisher ?? null,
    editionYear: doc.editionYear ?? doc.year ?? null,
    editor: doc.editor ?? null,
    language: doc.language ?? null,
    license: doc.license ?? null,
    rightsEvidence: doc.rightsEvidence ?? doc.rights ?? doc.description ?? null,
    metadataMatchScore: Math.max(overlap(record?.title, title), overlap(record?.author, author)),
    access: doc.access ?? null,
    identifiers: doc.identifiers ?? {}
  };
}

export function analyzeCandidate(candidate, record, options = {}) {
  const evidence = [];
  if (candidate.license) evidence.push({ kind: 'license', text: candidate.license, source: candidate.sourceUrl });
  if (candidate.rightsEvidence) evidence.push({ kind: 'rights', text: candidate.rightsEvidence, source: candidate.sourceUrl });
  if (candidate.access?.publicDomain === true) evidence.push({ kind: 'public-domain', text: 'provider marks item public domain', source: candidate.sourceUrl });
  if (candidate.access?.downloadAllowed === true) evidence.push({ kind: 'download-allowed', text: 'provider reports downloadable', source: candidate.sourceUrl });

  const judged = buildSearchRecord({
    ...record,
    title: candidate.title ?? record?.title,
    author: candidate.author ?? record?.author,
    publisher: candidate.publisher ?? record?.publisher,
    editor: candidate.editor ?? record?.editor,
    editionYear: candidate.editionYear ?? record?.editionYear,
    sourceUrl: candidate.sourceUrl,
    evidence
  });

  const providerOpen = candidate.access?.publicDomain === true || isExplicitOpenRights(candidate.license) || isExplicitOpenRights(candidate.rightsEvidence);
  const rightsCleared = providerOpen && [RIGHTS_DECISIONS.REDISTRIBUTABLE, RIGHTS_DECISIONS.LICENSED].includes(judged.rightsDecision) && judged.editionNeedsReview === false;
  const downloadable = Boolean(candidate.downloadUrl || candidate.access?.downloadAllowed === true);

  return {
    ...candidate,
    rightsDecision: judged.rightsDecision,
    workStatus: judged.workStatus,
    editionType: judged.editionType,
    editionNeedsReview: judged.editionNeedsReview,
    rightsVerified: rightsCleared,
    downloadVerified: downloadable,
    analystDecision: rightsCleared && downloadable ? 'eligible' : 'not-eligible',
    evidence: judged.rightsEvidence
  };
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: { accept: 'application/json', 'user-agent': 'Deen-Allah-Rechercher/2026' } });
  if (!response?.ok) return null;
  return await response.json();
}

async function searchInternetArchive(record, fetchImpl) {
  const url = new URL('https://archive.org/advancedsearch.php');
  url.searchParams.set('q', `"${searchQuery(record).replaceAll('"', '')}"`);
  url.searchParams.set('fl[]', 'identifier,title,creator,description,license,rights,year');
  url.searchParams.set('rows', String(MAX_RESULTS_PER_PROVIDER));
  url.searchParams.set('output', 'json');
  const payload = await fetchJson(url, fetchImpl);
  return (payload?.response?.docs ?? []).map(doc => normalizeDoc(GLOBAL_PROVIDERS.INTERNET_ARCHIVE, {
    ...doc,
    sourceUrl: `https://archive.org/details/${encodeURIComponent(doc.identifier)}`
  }, record));
}

async function searchOpenLibrary(record, fetchImpl) {
  const url = new URL('https://openlibrary.org/search.json');
  if (record?.title) url.searchParams.set('title', record.title);
  if (record?.author) url.searchParams.set('author', record.author);
  url.searchParams.set('fields', 'key,title,author_name,publisher,first_publish_year,language,ebook_access,ia,edition_key,editions');
  url.searchParams.set('limit', String(MAX_RESULTS_PER_PROVIDER));
  if (record?.requestedLanguage) url.searchParams.set('lang', record.requestedLanguage);
  const payload = await fetchJson(url, fetchImpl);
  return (payload?.docs ?? []).map(doc => normalizeDoc(GLOBAL_PROVIDERS.OPEN_LIBRARY, {
    title: doc.title,
    creator: doc.author_name,
    publisher: doc.publisher?.[0],
    year: doc.first_publish_year,
    sourceUrl: doc.key ? `https://openlibrary.org${doc.key}` : null,
    identifiers: { ia: doc.ia ?? [], editionKeys: doc.edition_key ?? [] },
    access: { readable: doc.ebook_access === 'public', downloadAllowed: doc.ebook_access === 'public', publicDomain: false },
    description: doc.edition_count ? `Open Library edition count: ${doc.edition_count}` : null
  }, record));
}

async function searchGoogleBooks(record, fetchImpl) {
  const url = new URL('https://www.googleapis.com/books/v1/volumes');
  url.searchParams.set('q', searchQuery(record));
  url.searchParams.set('maxResults', String(Math.min(MAX_RESULTS_PER_PROVIDER, 40)));
  const payload = await fetchJson(url, fetchImpl);
  return (payload?.items ?? []).map(item => {
    const v = item.volumeInfo ?? {};
    const a = item.accessInfo ?? {};
    const download = a.pdf?.isAvailable ? (a.webReaderLink ?? null) : null;
    return normalizeDoc(GLOBAL_PROVIDERS.GOOGLE_BOOKS, {
      title: v.title,
      creator: v.authors,
      publisher: v.publisher,
      year: v.publishedDate,
      language: v.language,
      sourceUrl: a.webReaderLink ?? v.infoLink ?? `https://books.google.com/books?id=${encodeURIComponent(item.id)}`,
      downloadUrl: download,
      license: a.publicDomain ? 'public domain (provider country)' : null,
      access: { publicDomain: a.publicDomain === true, downloadAllowed: Boolean(download) }
    }, record));
  });
}

async function searchEuropeana(record, fetchImpl, apiKey) {
  if (!apiKey) return { needsCredentials: true, candidates: [] };
  const url = new URL('https://api.europeana.eu/record/v2/search.json');
  url.searchParams.set('wskey', apiKey);
  url.searchParams.set('query', searchQuery(record));
  url.searchParams.set('rows', String(MAX_RESULTS_PER_PROVIDER));
  const payload = await fetchJson(url, fetchImpl);
  return { needsCredentials: false, candidates: (payload?.items ?? []).map(item => normalizeDoc(GLOBAL_PROVIDERS.EUROPEANA, {
    title: item.title,
    sourceUrl: item.guid ?? (item.id ? `https://www.europeana.eu/item${item.id}` : null),
    rights: item.rights?.[0],
    description: item.dcDescriptionLangAware ? JSON.stringify(item.dcDescriptionLangAware) : null,
    access: { downloadAllowed: Array.isArray(item.edmIsShownBy) && item.edmIsShownBy.length > 0 }
  }, record)) };
}

async function searchGallica(record, fetchImpl) {
  const url = new URL('https://gallica.bnf.fr/SRU');
  url.searchParams.set('version', '1.2');
  url.searchParams.set('operation', 'searchRetrieve');
  url.searchParams.set('query', `dc.title all "${searchQuery(record).replaceAll('"', '')}"`);
  url.searchParams.set('maximumRecords', String(MAX_RESULTS_PER_PROVIDER));
  const response = await fetchImpl(url, { headers: { accept: 'application/xml', 'user-agent': 'Deen-Allah-Rechercher/2026' } });
  if (!response?.ok) return [];
  const xml = await response.text();
  const docs = [...xml.matchAll(/<srw:record>([\s\S]*?)<\/srw:record>/giu)];
  return docs.map(block => {
    const b = block[1];
    const pick = tag => b.match(new RegExp(`<[^>]*${tag}[^>]*>([\\s\\S]*?)<\\/[^>]*${tag}>`, 'iu'))?.[1]?.replace(/<[^>]+>/g, '').trim() ?? null;
    const ark = b.match(/ark:\/\/\/?([\w.:-]+)/iu)?.[1] ?? null;
    return normalizeDoc(GLOBAL_PROVIDERS.GALLICA, { title: pick('dc:title'), creator: pick('dc:creator'), sourceUrl: ark ? `https://gallica.bnf.fr/ark:/12148/${ark}` : null, rights: pick('dc:rights') }, record);
  });
}

async function searchDpla(record, fetchImpl, apiKey) {
  if (!apiKey) return { needsCredentials: true, candidates: [] };
  const url = new URL('https://api.dp.la/v2/items');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('q', searchQuery(record));
  url.searchParams.set('page_size', String(MAX_RESULTS_PER_PROVIDER));
  const payload = await fetchJson(url, fetchImpl);
  return { needsCredentials: false, candidates: (payload?.docs ?? []).map(item => normalizeDoc(GLOBAL_PROVIDERS.DPLA, {
    title: item.sourceResource?.title,
    creator: item.sourceResource?.creator,
    sourceUrl: item.isShownAt ?? item.object,
    rights: item.sourceResource?.rights,
    license: Array.isArray(item.sourceResource?.rights) ? item.sourceResource.rights.find(x => DPLA_RIGHTS_REUSE.has(x)) : null,
    access: { downloadAllowed: Boolean(item.object) }
  }, record)) };
}

async function searchWorldcat(record, fetchImpl, apiKey, endpoint) {
  if (!apiKey || !endpoint) return { needsCredentials: true, candidates: [] };
  const url = new URL(endpoint);
  url.searchParams.set('q', searchQuery(record));
  url.searchParams.set('limit', String(MAX_RESULTS_PER_PROVIDER));
  const payload = await fetchJson(url, fetchImpl);
  return { needsCredentials: false, candidates: (payload?.records ?? []).map(item => normalizeDoc(GLOBAL_PROVIDERS.WORLDCAT, {
    title: item.title,
    creator: item.creator,
    publisher: item.publisher,
    year: item.year,
    sourceUrl: item.uri ?? item.url,
    identifiers: item.identifiers
  }, record)) };
}

export async function globalSearchAnalysts(record, { fetchImpl = globalThis.fetch, europeanaKey = process.env.EUROPEANA_API_KEY, dplaKey = process.env.DPLA_API_KEY, worldcatKey = process.env.WORLDCAT_API_KEY, worldcatEndpoint = process.env.WORLDCAT_SEARCH_ENDPOINT } = {}) {
  if (typeof fetchImpl !== 'function') return { outcome: GLOBAL_OUTCOMES.NEEDS_DISCOVERY, candidates: [], providerStatus: [] };
  const providerStatus = [];
  const all = [];

  const tasks = [
    [GLOBAL_PROVIDERS.INTERNET_ARCHIVE, () => searchInternetArchive(record, fetchImpl)],
    [GLOBAL_PROVIDERS.OPEN_LIBRARY, () => searchOpenLibrary(record, fetchImpl)],
    [GLOBAL_PROVIDERS.GOOGLE_BOOKS, () => searchGoogleBooks(record, fetchImpl)],
    [GLOBAL_PROVIDERS.EUROPEANA, () => searchEuropeana(record, fetchImpl, europeanaKey)],
    [GLOBAL_PROVIDERS.GALLICA, () => searchGallica(record, fetchImpl)],
    [GLOBAL_PROVIDERS.DPLA, () => searchDpla(record, fetchImpl, dplaKey)],
    [GLOBAL_PROVIDERS.WORLDCAT, () => searchWorldcat(record, fetchImpl, worldcatKey, worldcatEndpoint)]
  ];

  for (const [provider, task] of tasks) {
    try {
      const result = await task();
      if (result?.needsCredentials) {
        providerStatus.push({ provider, status: 'needs-credentials' });
        continue;
      }
      const candidates = Array.isArray(result) ? result : result?.candidates ?? [];
      providerStatus.push({ provider, status: 'ok', count: candidates.length });
      all.push(...candidates);
    } catch (error) {
      providerStatus.push({ provider, status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  }

  const analyzed = all.map(candidate => analyzeCandidate(candidate, record)).filter(c => c.metadataMatchScore >= 0.5);
  const eligible = analyzed.filter(c => c.rightsVerified && c.downloadVerified)
    .sort((a, b) => b.metadataMatchScore - a.metadataMatchScore);

  return {
    outcome: eligible.length ? GLOBAL_OUTCOMES.ALTERNATIVE_FOUND : GLOBAL_OUTCOMES.READ_ONLY_ORIGINAL,
    selected: eligible[0] ?? null,
    candidates: analyzed,
    providerStatus
  };
}
