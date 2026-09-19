export const TAJWEED_STATES = Object.freeze(['CANDIDATE','REVIEWED']);
export const MEMORIZATION_STATES = Object.freeze(['NEW','LEARNING','RETAINED','MASTERED']);

export function createQuranTajweedMemorizationEngine() { return { verses: new Map(), tajweed: new Map(), memorization: new Map() }; }

export function registerVerse(engine, { verseId, surah, ayah, arabic, sourceId, sourceHash } = {}) {
  if (!verseId || !surah || !ayah || !arabic || !sourceId || !sourceHash) throw new TypeError('Canonical verse requires identity, Arabic text and source hash');
  if (engine.verses.has(verseId)) throw new Error(`Duplicate verse: ${verseId}`);
  engine.verses.set(verseId, { verseId, surah, ayah, arabic, sourceId, sourceHash }); return verseId;
}

export function addTajweedFinding(engine, { findingId, verseId, rule, locator, state = 'CANDIDATE', reviewerRole = null } = {}) {
  if (!engine.verses.has(verseId)) throw new Error('Unknown verse');
  if (!TAJWEED_STATES.includes(state)) throw new TypeError('Invalid tajweed state');
  if (state === 'REVIEWED' && !['TEACHER','SCHOLAR'].includes(reviewerRole)) throw new Error('Teacher or scholar review required');
  const finding = { findingId, verseId, rule, locator, state, reviewerRole }; engine.tajweed.set(findingId, finding); return findingId;
}

export function recordMemorization(engine, { learnerId, verseId, correct, confidence = 0, at = null } = {}) {
  if (!engine.verses.has(verseId)) throw new Error('Unknown verse');
  if (!learnerId) throw new TypeError('learnerId is required');
  const key = `${learnerId}:${verseId}`; const previous = engine.memorization.get(key) || { learnerId, verseId, attempts: 0, successes: 0, state: 'NEW', confidence: 0 };
  previous.attempts += 1; if (correct) previous.successes += 1; previous.confidence = confidence; previous.state = previous.successes >= 3 && previous.attempts >= 3 && confidence >= 0.8 ? 'MASTERED' : previous.successes > 0 ? 'RETAINED' : 'LEARNING'; previous.lastAttemptAt = at;
  engine.memorization.set(key, previous); return structuredClone(previous);
}
