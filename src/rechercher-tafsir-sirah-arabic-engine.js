export const CONTENT_DOMAINS = Object.freeze(['TAFSIR','SIRAH','ARABIC']);

export function createTafsirSirahArabicEngine() {
  return { items: new Map(), references: new Map(), concepts: new Map(), alignments: new Map() };
}

function required(value, name) { if (!value) throw new TypeError(`${name} is required`); }

export function registerItem(engine, { itemId, domain, title, language = 'ar', sourceId, sourceHash, rightsStatus = 'UNKNOWN' } = {}) {
  required(itemId, 'itemId'); required(title, 'title'); required(sourceId, 'sourceId'); required(sourceHash, 'sourceHash');
  if (!CONTENT_DOMAINS.includes(domain)) throw new TypeError(`Unknown domain: ${domain}`);
  engine.items.set(itemId, { itemId, domain, title, language, sourceId, sourceHash, rightsStatus });
  return itemId;
}

export function addReference(engine, { referenceId, itemId, locator, textRange = '', pageImageHash = '' } = {}) {
  required(referenceId, 'referenceId'); required(itemId, 'itemId'); required(locator, 'locator');
  if (!engine.items.has(itemId)) throw new Error(`Unknown item: ${itemId}`);
  const reference = { referenceId, itemId, locator, textRange, pageImageHash };
  engine.references.set(referenceId, reference);
  return reference;
}

export function registerConcept(engine, { conceptId, label, domain, sourceIds = [] } = {}) {
  required(conceptId, 'conceptId'); required(label, 'label');
  if (!CONTENT_DOMAINS.includes(domain)) throw new TypeError(`Unknown domain: ${domain}`);
  engine.concepts.set(conceptId, { conceptId, label, domain, sourceIds: [...sourceIds] });
  return conceptId;
}

export function alignArabicTerm(engine, { alignmentId, conceptId, term, normalizedTerm, sourceId, sourceHash } = {}) {
  required(alignmentId, 'alignmentId'); required(conceptId, 'conceptId'); required(term, 'term'); required(normalizedTerm, 'normalizedTerm'); required(sourceId, 'sourceId'); required(sourceHash, 'sourceHash');
  if (!engine.concepts.has(conceptId)) throw new Error(`Unknown concept: ${conceptId}`);
  const alignment = { alignmentId, conceptId, term, normalizedTerm, sourceId, sourceHash };
  engine.alignments.set(alignmentId, alignment);
  return alignment;
}

export function publishableItem(engine, itemId) {
  const item = engine.items.get(itemId);
  if (!item) throw new Error(`Unknown item: ${itemId}`);
  return item.rightsStatus === 'ALLOWED';
}
