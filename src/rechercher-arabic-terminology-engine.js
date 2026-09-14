const DIALECTS = Object.freeze(['ARABIC_CLASSICAL', 'ARABIC_MODERN', 'USER_LANGUAGE']);

function createArabicTerminologyEngine() {
  return { terms: new Map(), concepts: new Map(), alignments: new Map() };
}

function registerConcept(engine, { conceptId, label, domain, sourceId }) {
  if (!conceptId || !label || !domain || !sourceId) throw new Error('concept requires identity, domain and source');
  const concept = { conceptId, label, domain, sourceId };
  engine.concepts.set(conceptId, concept);
  return concept;
}

function registerTerm(engine, { termId, conceptId, text, language = 'ar', register = 'ARABIC_CLASSICAL', sourceId }) {
  if (!engine.concepts.has(conceptId) || !termId || !text || !sourceId) throw new Error('term must link to a concept and source');
  if (!DIALECTS.includes(register)) throw new Error('unsupported terminology register');
  const term = { termId, conceptId, text, language, register, sourceId };
  engine.terms.set(termId, term);
  return term;
}

function alignTerms(engine, { alignmentId, termIds, confidence, reviewerId = null }) {
  if (!Array.isArray(termIds) || termIds.length < 2 || !(confidence >= 0 && confidence <= 1)) throw new Error('alignment requires multiple terms and bounded confidence');
  const alignment = { alignmentId, termIds: [...termIds], confidence, reviewerId, state: reviewerId ? 'REVIEWED' : 'CANDIDATE' };
  engine.alignments.set(alignmentId, alignment);
  return alignment;
}

function getConceptTerms(engine, conceptId) {
  return [...engine.terms.values()].filter(term => term.conceptId === conceptId);
}

module.exports = { DIALECTS, createArabicTerminologyEngine, registerConcept, registerTerm, alignTerms, getConceptTerms };
