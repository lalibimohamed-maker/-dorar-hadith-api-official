export const MATCH_TYPES = Object.freeze(['EXACT','CLOSE','HISTORICAL','SCHOOL_SPECIFIC','NO_EXACT_EQUIVALENT']);

export function createConceptEngine() {
  return { concepts: new Map(), terms: new Map(), alignments: new Map() };
}

export function registerConcept(engine, concept) {
  if (!concept?.conceptId || !concept?.label) throw new TypeError('Concept requires conceptId and label');
  if (engine.concepts.has(concept.conceptId)) throw new Error(`Duplicate concept: ${concept.conceptId}`);
  engine.concepts.set(concept.conceptId, structuredClone(concept));
  return concept.conceptId;
}

export function registerTerm(engine, { termId, conceptId, language, term, sourceIds = [] } = {}) {
  if (!termId || !conceptId || !language || !term) throw new TypeError('Term requires termId, conceptId, language and term');
  if (!engine.concepts.has(conceptId)) throw new TypeError(`Unknown concept: ${conceptId}`);
  engine.terms.set(termId, { termId, conceptId, language, term, sourceIds: [...sourceIds] });
  return termId;
}

export function alignTerms(engine, { alignmentId, fromTermId, toTermId, matchType, confidence = 0, sourceIds = [] } = {}) {
  if (!alignmentId || !fromTermId || !toTermId || !MATCH_TYPES.includes(matchType)) throw new TypeError('Invalid terminology alignment');
  if (!engine.terms.has(fromTermId) || !engine.terms.has(toTermId)) throw new TypeError('Unknown term in alignment');
  const alignment = { alignmentId, fromTermId, toTermId, matchType, confidence: Math.max(0, Math.min(1, confidence)), sourceIds: [...sourceIds] };
  engine.alignments.set(alignmentId, alignment);
  return alignmentId;
}
