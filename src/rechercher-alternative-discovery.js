const ENDPOINTS = Object.freeze({
  INTERNET_ARCHIVE: 'https://archive.org/advancedsearch.php'
});

function normalize(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokenOverlap(a, b) {
  const left = new Set(normalize(a).split(' ').filter(Boolean));
  const right = new Set(normalize(b).split(' ').filter(Boolean));
  if (!left.size || !right.size) return 0;
  let hits = 0;
  for (const token of left) if (right.has(token)) hits++;
  return hits / Math.max(left.size, right.size);
}

function buildArchiveQuery(record) {
  const parts = [record?.title, record?.author, record?.editor].filter(Boolean);
  return parts.length ? parts.map(x => `"${String(x).replaceAll('"', '')}"`).join(' AND ') : null;
}

function isRightsCleared(doc) {
  const text = `${doc?.rightsEvidence ?? ''} ${doc?.license ?? ''} ${doc?.description ?? ''}`.toLowerCase();
  return Boolean(
    doc?.rightsVerified === true && (
      ['public domain', 'public-domain', 'creative commons', 'cc by', 'cc0', 'open access', 'permission to redistribute']
        .some(marker => text.includes(marker))
    )
  );
}

export async function discoverArchiveAlternatives(record, { fetchImpl = globalThis.fetch, limit = 20 } = {}) {
  const q = buildArchiveQuery(record);
  if (!q || typeof fetchImpl !== 'function') return [];

  const url = new URL(ENDPOINTS.INTERNET_ARCHIVE);
  url.searchParams.set('q', q);
  url.searchParams.set('fl[]', 'identifier,title,creator,description,license,rights,year');
  url.searchParams.set('rows', String(Math.min(Math.max(limit, 1), 50)));
  url.searchParams.set('output', 'json');

  const response = await fetchImpl(url);
  if (!response?.ok) return [];
  const payload = await response.json();
  const docs = Array.isArray(payload?.response?.docs) ? payload.response.docs : [];

  return docs.map(doc => ({
    sourceUrl: `https://archive.org/details/${encodeURIComponent(doc.identifier)}`,
    downloadUrl: `https://archive.org/metadata/${encodeURIComponent(doc.identifier)}`,
    title: doc.title ?? null,
    author: Array.isArray(doc.creator) ? doc.creator[0] : (doc.creator ?? null),
    description: doc.description ?? null,
    license: doc.license ?? null,
    rightsEvidence: doc.rights ?? doc.license ?? doc.description ?? null,
    rightsVerified: false,
    rightsDecision: 'unclear',
    metadataMatchScore: tokenOverlap(record?.title, doc.title)
  }));
}

export async function governedAlternativeDiscovery(record, options = {}) {
  const discovered = await discoverArchiveAlternatives(record, options);
  return discovered
    .filter(candidate => candidate.metadataMatchScore >= 0.5)
    .sort((a, b) => b.metadataMatchScore - a.metadataMatchScore);
}
