const SOURCE_TYPES = new Set(['quran', 'hadith', 'tafsir', 'asbab_al_nuzul', 'sirah', 'sharh', 'rijal', 'fatwa', 'fiqh', 'aqidah', 'other']);

function required(value, fields) {
  return fields.filter(field => value[field] == null || value[field] === '').map(field => `missing:${field}`);
}

export function validateSource(source = {}) {
  const errors = required(source, ['id', 'title', 'type']);
  if (source.type && !SOURCE_TYPES.has(source.type)) errors.push(`unknown-type:${source.type}`);
  return { valid: errors.length === 0, errors };
}

export function validateCitation(citation = {}, sourceRegistry) {
  const errors = required(citation, ['id', 'sourceId', 'locator']);
  if (citation.sourceId && sourceRegistry && !sourceRegistry.has(citation.sourceId)) errors.push('unknown-source');
  if (citation.generated === true) errors.push('generated-citation-not-allowed');
  return { valid: errors.length === 0, errors };
}

export function registerSource(registry, source) {
  const result = validateSource(source);
  if (!result.valid) throw new TypeError(`Invalid source: ${result.errors.join(',')}`);
  if (registry.has(source.id)) throw new TypeError(`Duplicate source: ${source.id}`);
  registry.set(source.id, structuredClone(source));
  return source.id;
}

export function registerCitation(registry, sourceRegistry, citation) {
  const result = validateCitation(citation, sourceRegistry);
  if (!result.valid) throw new TypeError(`Invalid citation: ${result.errors.join(',')}`);
  if (registry.has(citation.id)) throw new TypeError(`Duplicate citation: ${citation.id}`);
  registry.set(citation.id, structuredClone(citation));
  return citation.id;
}

export function buildProvenanceRegistry(sources = [], citations = []) {
  const sourceRegistry = new Map();
  const citationRegistry = new Map();
  for (const source of sources) registerSource(sourceRegistry, source);
  for (const citation of citations) registerCitation(citationRegistry, sourceRegistry, citation);
  return { sources: [...sourceRegistry.values()], citations: [...citationRegistry.values()] };
}
