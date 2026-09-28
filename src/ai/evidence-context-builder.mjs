const CONTENT_KEYS = Object.freeze(['text','excerpt','matn','content','quote']);
const LOCATION_KEYS = Object.freeze(['locator','location','page','pageNumber','volume','chapter','hadithNumber','ayah','surah']);

function firstNonEmpty(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (Number.isFinite(value)) return String(value);
  }
  return null;
}

function pushRecord(records, value, path = 'search') {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => pushRecord(records, item, `${path}[${index}]`));
    return;
  }
  if (typeof value !== 'object') return;

  const text = firstNonEmpty(value, CONTENT_KEYS);
  const source = firstNonEmpty(value, ['source','url','sourceUrl','reference']);
  if (text && source) {
    records.push({
      raw: value,
      path,
      text,
      title: firstNonEmpty(value, ['title','work','name','author']),
      source,
      verification: value.verification || value.status || 'unknown',
      rights: value.rights || value.reusePolicy || 'source-dependent',
      location: firstNonEmpty(value, LOCATION_KEYS),
      id: value.id || null
    });
  }

  for (const [key, nested] of Object.entries(value)) {
    if (CONTENT_KEYS.includes(key)) continue;
    if (nested && typeof nested === 'object') pushRecord(records, nested, `${path}.${key}`);
  }
}

export function buildEvidenceContext(searchResult, { maxItems = 8, maxCharsPerItem = 1800 } = {}) {
  const collected = [];
  pushRecord(collected, searchResult);
  const dedup = new Map();
  for (const item of collected) {
    const key = item.id ? `id:${item.id}` : `${item.source}|${item.location || ''}|${item.text.slice(0, 120)}`;
    if (!dedup.has(key)) dedup.set(key, { ...item, text: item.text.slice(0, maxCharsPerItem) });
  }

  const evidence = [...dedup.values()].slice(0, maxItems).map((item, index) => ({
    citationId: `E${index + 1}`,
    id: item.id,
    title: item.title,
    text: item.text,
    source: item.source,
    location: item.location,
    verification: item.verification,
    rights: item.rights,
    sourcePath: item.path
  }));

  return Object.freeze({
    evidence,
    count: evidence.length,
    hasSufficientEvidence: evidence.length > 0,
    policy: {
      originalTextRetained: true,
      sourceRetained: true,
      locationRetained: true,
      rightsRetained: true,
      generatedTextIsCanonical: false
    }
  });
}

export function formatEvidenceForPrompt(evidence = []) {
  return evidence.map(item =>
    `[${item.citationId}] ${item.title || item.id || 'source'}\nSource: ${item.source}\nLocation: ${item.location || 'not recorded'}\nVerification: ${item.verification}\nText: ${item.text}`
  ).join('\n\n');
}
