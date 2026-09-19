export const MATCH_TYPES = Object.freeze(['EXACT','CLOSE','HISTORICAL','SCHOOL_SPECIFIC','TRANSLATION_VARIANT','NO_EXACT_EQUIVALENT']);
export const SCRIPT_VARIANTS = Object.freeze(['ARABIC','LATIN','TURKISH_LATIN','PERSIAN','URDU','INDONESIAN_LATIN','MALAY_LATIN','CYRILLIC','OTHER']);

export function createConceptEngine() {
  return { concepts: new Map(), terms: new Map(), alignments: new Map(), translationVariants: new Map() };
}

export function registerConcept(engine, concept) {
  if (!concept?.conceptId || !concept?.label) throw new TypeError('Concept requires conceptId and label');
  if (engine.concepts.has(concept.conceptId)) throw new Error(`Duplicate concept: ${concept.conceptId}`);
  engine.concepts.set(concept.conceptId, structuredClone(concept));
  return concept.conceptId;
}

export function registerTerm(engine, { termId, conceptId, language, term, sourceIds = [], script = 'OTHER', transliteration = null, historical = false, school = null } = {}) {
  if (!termId || !conceptId || !language || !term) throw new TypeError('Term requires termId, conceptId, language and term');
  if (!engine.concepts.has(conceptId)) throw new TypeError(`Unknown concept: ${conceptId}`);
  if (!SCRIPT_VARIANTS.includes(script)) throw new TypeError('Invalid script variant');
  engine.terms.set(termId, { termId, conceptId, language, term, sourceIds: [...sourceIds], script, transliteration, historical: Boolean(historical), school });
  return termId;
}

export function alignTerms(engine, { alignmentId, fromTermId, toTermId, matchType, confidence = 0, sourceIds = [], provenance = null, reviewState = 'UNVERIFIED' } = {}) {
  if (!alignmentId || !fromTermId || !toTermId || !MATCH_TYPES.includes(matchType)) throw new TypeError('Invalid terminology alignment');
  if (!engine.terms.has(fromTermId) || !engine.terms.has(toTermId)) throw new TypeError('Unknown term in alignment');
  if (!provenance) throw new Error('terminology provenance is required');
  const alignment = { alignmentId, fromTermId, toTermId, matchType, confidence: Math.max(0, Math.min(1, confidence)), sourceIds: [...sourceIds], provenance: structuredClone(provenance), reviewState };
  engine.alignments.set(alignmentId, alignment);
  return alignmentId;
}

export function registerTranslationVariant(engine, { variantId, termId, language, text, sourceIds = [], exact = false, reviewState = 'UNVERIFIED' } = {}) {
  if (!variantId || !termId || !language || !text) throw new TypeError('Translation variant requires variantId, termId, language and text');
  if (!engine.terms.has(termId)) throw new TypeError('Unknown source term');
  const variant = { variantId, termId, language, text, sourceIds: [...sourceIds], exact: Boolean(exact), reviewState };
  engine.translationVariants.set(variantId, variant);
  return structuredClone(variant);
}

export function findNoExactEquivalent(engine, termId) {
  if (!engine.terms.has(termId)) throw new TypeError('Unknown term');
  return [...engine.alignments.values()].filter((alignment) => alignment.fromTermId === termId && alignment.matchType === 'NO_EXACT_EQUIVALENT').map(structuredClone);
}
