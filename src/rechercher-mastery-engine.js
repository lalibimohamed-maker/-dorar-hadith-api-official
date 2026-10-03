export const MASTERY_STATES = Object.freeze(['NEW','LEARNING','PRACTICING','MASTERED']);

export function createMasteryEngine() {
  return { concepts: new Map(), attempts: new Map(), paths: new Map() };
}

export function registerMasteryConcept(engine, { conceptId, prerequisites = [], domain, sourceIds = [] } = {}) {
  if (!conceptId || !domain) throw new TypeError('Mastery concept requires conceptId and domain');
  if (engine.concepts.has(conceptId)) throw new Error(`Duplicate mastery concept: ${conceptId}`);
  engine.concepts.set(conceptId, { conceptId, prerequisites: [...prerequisites], domain, sourceIds: [...sourceIds] });
  return conceptId;
}

export function recordMasteryAttempt(engine, { attemptId, learnerId, conceptId, correct, confidence = 0, evidenceIds = [] } = {}) {
  if (!attemptId || !learnerId || !conceptId) throw new TypeError('Mastery attempt requires identity, learner and concept');
  if (!engine.concepts.has(conceptId)) throw new Error(`Unknown mastery concept: ${conceptId}`);
  const c = Math.max(0, Math.min(1, confidence));
  const attempt = { attemptId, learnerId, conceptId, correct: Boolean(correct), confidence: c, evidenceIds: [...evidenceIds], at: new Date().toISOString() };
  engine.attempts.set(attemptId, attempt);
  return attempt;
}

export function masteryState(engine, learnerId, conceptId) {
  const attempts = [...engine.attempts.values()].filter((x) => x.learnerId === learnerId && x.conceptId === conceptId);
  if (!attempts.length) return 'NEW';
  const recent = attempts.slice(-5);
  const score = recent.reduce((sum, x) => sum + (x.correct ? 1 : 0), 0) / recent.length;
  if (score >= 0.9 && recent.length >= 4) return 'MASTERED';
  if (score >= 0.6) return 'PRACTICING';
  return 'LEARNING';
}

export function nextPrerequisite(engine, conceptId, completed = new Set()) {
  const concept = engine.concepts.get(conceptId);
  if (!concept) throw new Error(`Unknown mastery concept: ${conceptId}`);
  return concept.prerequisites.find((id) => !completed.has(id)) || null;
}
