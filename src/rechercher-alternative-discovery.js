import { buildSearchRecord, inspectSourceUrl, RIGHTS_DECISIONS } from './rechercher-rights-engine.js';

const ENDPOINTS = Object.freeze({
  INTERNET_ARCHIVE_SEARCH: 'https://archive.org/advancedsearch.php',
  INTERNET_ARCHIVE_METADATA: 'https://archive.org/metadata/'
});

function normalize(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/[\u064B-\u065F\u0670]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}
function tokenOverlap(a, b) {
  const left = new Set(normalize(a).split(' ').filter(Boolean)); const right = new Set(normalize(b).split(' ').filter(Boolean));
  if (!left.size || !right.size) return 0; let hits = 0; for (const token of left) if (right.has(token)) hits++; return hits / Math.max(left.size, right.size);
}
function buildArchiveQuery(record) {
  const parts = [record?.title, record?.author, record?.editor].filter(Boolean);
  return parts.length ? parts.map(x => `"${String(x).replaceAll('"', '')}"`).join(' AND ') : null;
}
function firstPdfFile(files = []) { return files.find(file => typeof file?.name === 'string' && /\.pdf$/iu.test(file.name) && !file.private); }

export async function discoverArchiveAlternatives(record, { fetchImpl = globalThis.fetch, inspectImpl = inspectSourceUrl, limit = 20, verify = false } = {}) {
  const q = buildArchiveQuery(record); if (!q || typeof fetchImpl !== 'function') return [];
  const searchUrl = new URL(ENDPOINTS.INTERNET_ARCHIVE_SEARCH); searchUrl.searchParams.set('q', q); searchUrl.searchParams.set('fl[]', 'identifier,title,creator,description,license,rights,year'); searchUrl.searchParams.set('rows', String(Math.min(Math.max(limit, 1), 50))); searchUrl.searchParams.set('output', 'json');
  const response = await fetchImpl(searchUrl); if (!response?.ok) return [];
  const payload = await response.json(); const docs = Array.isArray(payload?.response?.docs) ? payload.response.docs : [];
  const candidates = docs.map(doc => ({
    identifier: doc.identifier,
    sourceUrl: `https://archive.org/details/${encodeURIComponent(doc.identifier)}`,
    title: doc.title ?? null,
    author: Array.isArray(doc.creator) ? doc.creator[0] : (doc.creator ?? null),
    license: doc.license ?? null,
    rightsEvidence: doc.rights ?? doc.license ?? doc.description ?? null,
    rightsVerified: false,
    rightsDecision: 'unclear',
    metadataMatchScore: tokenOverlap(record?.title, doc.title)
  })).filter(candidate => candidate.identifier && candidate.metadataMatchScore >= 0.5);

  if (!verify) return candidates;
  const verified = [];
  for (const candidate of candidates) {
    try {
      const inspected = await inspectImpl(candidate.sourceUrl);
      const judged = buildSearchRecord({ title: candidate.title, author: candidate.author, publisher: record?.publisher, license: candidate.license, sourceUrl: candidate.sourceUrl, evidence: candidate.rightsEvidence ? [{ kind: 'source-rights-metadata', text: candidate.rightsEvidence }] : [] }, inspected?.metadata ?? {});
      const rightsVerified = [RIGHTS_DECISIONS.REDISTRIBUTABLE, RIGHTS_DECISIONS.LICENSED].includes(judged.rightsDecision) && judged.editionNeedsReview === false;
      if (!rightsVerified) continue;
      const metaResponse = await fetchImpl(`${ENDPOINTS.INTERNET_ARCHIVE_METADATA}${encodeURIComponent(candidate.identifier)}`);
      if (!metaResponse?.ok) continue;
      const metadata = await metaResponse.json(); const pdf = firstPdfFile(metadata?.files); if (!pdf?.name) continue;
      verified.push({ ...candidate, downloadUrl: `https://archive.org/download/${encodeURIComponent(candidate.identifier)}/${String(pdf.name).split('/').map(encodeURIComponent).join('/')}`, rightsVerified: true, rightsDecision: judged.rightsDecision, rightsVerificationSource: candidate.sourceUrl, rightsEvidence: judged.rightsEvidence, editionType: judged.editionType, workStatus: judged.workStatus, editionNeedsReview: false });
    } catch {
      // Fail closed for this candidate; continue searching other candidates.
    }
  }
  return verified;
}

export async function governedAlternativeDiscovery(record, options = {}) {
  return (await discoverArchiveAlternatives(record, options)).sort((a, b) => (b.metadataMatchScore ?? 0) - (a.metadataMatchScore ?? 0));
}
