export const RIJAL_STATES = Object.freeze(['REPORTED','SOURCE_VERIFIED','SCHOLAR_REVIEWED','DISPUTED','UNKNOWN']);

export function createTakhrijRijalEngine() {
  return { hadiths: new Map(), occurrences: new Map(), narrators: new Map(), evaluations: new Map() };
}

function required(value, name) { if (!value) throw new TypeError(`${name} is required`); }

export function registerHadith(engine, { hadithId, text, canonicalSourceId, canonicalSourceHash } = {}) {
  required(hadithId, 'hadithId'); required(text, 'text'); required(canonicalSourceId, 'canonicalSourceId'); required(canonicalSourceHash, 'canonicalSourceHash');
  if (engine.hadiths.has(hadithId)) throw new Error(`Duplicate hadith: ${hadithId}`);
  engine.hadiths.set(hadithId, { hadithId, text, canonicalSourceId, canonicalSourceHash });
  return hadithId;
}

export function addTakhrijOccurrence(engine, { occurrenceId, hadithId, sourceId, sourceHash, locator, edition = '' } = {}) {
  required(occurrenceId, 'occurrenceId'); required(hadithId, 'hadithId'); required(sourceId, 'sourceId'); required(sourceHash, 'sourceHash'); required(locator, 'locator');
  if (!engine.hadiths.has(hadithId)) throw new Error(`Unknown hadith: ${hadithId}`);
  const occurrence = { occurrenceId, hadithId, sourceId, sourceHash, locator, edition, state: 'SOURCE_VERIFIED' };
  engine.occurrences.set(occurrenceId, occurrence);
  return occurrence;
}

export function registerNarrator(engine, { narratorId, name, sourceIds = [], notes = '' } = {}) {
  required(narratorId, 'narratorId'); required(name, 'name');
  if (!Array.isArray(sourceIds)) throw new TypeError('sourceIds must be an array');
  engine.narrators.set(narratorId, { narratorId, name, sourceIds: [...sourceIds], notes });
  return narratorId;
}

export function addNarratorEvaluation(engine, { evaluationId, narratorId, scholarId, status, sourceIds = [], note = '' } = {}) {
  required(evaluationId, 'evaluationId'); required(narratorId, 'narratorId'); required(scholarId, 'scholarId'); required(status, 'status');
  if (!engine.narrators.has(narratorId)) throw new Error(`Unknown narrator: ${narratorId}`);
  if (!RIJAL_STATES.includes(status)) throw new TypeError(`Unknown rijal state: ${status}`);
  const evaluation = { evaluationId, narratorId, scholarId, status, sourceIds: [...sourceIds], note };
  engine.evaluations.set(evaluationId, evaluation);
  return evaluation;
}

export function summarizeTakhrij(engine, hadithId) {
  if (!engine.hadiths.has(hadithId)) throw new Error(`Unknown hadith: ${hadithId}`);
  return {
    hadith: engine.hadiths.get(hadithId),
    occurrences: [...engine.occurrences.values()].filter((x) => x.hadithId === hadithId),
  };
}
