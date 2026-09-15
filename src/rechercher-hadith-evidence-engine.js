export const GRADE_STATES = Object.freeze(['REPORTED','SCHOLAR_REVIEWED','DISPUTED','UNKNOWN']);

export function createHadithEvidenceEngine() {
  return { hadiths: new Map(), chains: new Map(), gradings: new Map(), sources: new Map() };
}

export function registerHadith(engine, { hadithId, text, sourceId, sourceHash, language = 'ar' } = {}) {
  if (!hadithId || !text || !sourceId || !sourceHash) throw new TypeError('Hadith requires identity, text, source and source hash');
  if (engine.hadiths.has(hadithId)) throw new Error(`Duplicate hadith: ${hadithId}`);
  engine.hadiths.set(hadithId, { hadithId, text, language, sourceId, sourceHash });
  return hadithId;
}

export function addTransmissionPath(engine, { hadithId, pathId, narrators = [], sourceIds = [] } = {}) {
  if (!engine.hadiths.has(hadithId)) throw new Error(`Unknown hadith: ${hadithId}`);
  if (!pathId || !Array.isArray(narrators)) throw new TypeError('Transmission path requires pathId and narrators');
  const path = { pathId, hadithId, narrators: structuredClone(narrators), sourceIds: [...sourceIds] };
  engine.chains.set(pathId, path);
  return path;
}

export function addScholarlyGrading(engine, { gradingId, hadithId, scholarId, grade, sourceIds = [], note = '' } = {}) {
  if (!gradingId || !hadithId || !scholarId || !grade) throw new TypeError('Grading requires identity, hadith, scholar and grade');
  if (!engine.hadiths.has(hadithId)) throw new Error(`Unknown hadith: ${hadithId}`);
  const item = { gradingId, hadithId, scholarId, grade, sourceIds: [...sourceIds], note, state: 'SCHOLAR_REVIEWED' };
  engine.gradings.set(gradingId, item);
  return item;
}

export function summarizeHadithEvidence(engine, hadithId) {
  if (!engine.hadiths.has(hadithId)) throw new Error(`Unknown hadith: ${hadithId}`);
  return {
    hadithId,
    transmissionPaths: [...engine.chains.values()].filter((x) => x.hadithId === hadithId),
    scholarlyGradings: [...engine.gradings.values()].filter((x) => x.hadithId === hadithId),
  };
}
