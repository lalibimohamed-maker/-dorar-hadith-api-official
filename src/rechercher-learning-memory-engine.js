export const MEMORY_SCOPES = Object.freeze(['SESSION', 'LONG_TERM']);

export function createLearningMemoryEngine() {
  return { sessions: new Map(), longTerm: new Map() };
}

function requireId(value, name) {
  if (!value) throw new TypeError(`${name} is required`);
}

export function recordSessionEvent(engine, { learnerId, sessionId, eventId, type, payload = {}, at = new Date().toISOString() } = {}) {
  requireId(learnerId, 'learnerId');
  requireId(sessionId, 'sessionId');
  requireId(eventId, 'eventId');
  requireId(type, 'type');
  const session = engine.sessions.get(sessionId) || { sessionId, learnerId, events: [] };
  if (session.learnerId !== learnerId) throw new Error('session belongs to another learner');
  session.events.push({ eventId, type, payload: structuredClone(payload), at });
  engine.sessions.set(sessionId, session);
  return session.events.at(-1);
}

export function promoteMemory(engine, { learnerId, memoryId, key, value, sourceIds = [], reason = '', at = new Date().toISOString() } = {}) {
  requireId(learnerId, 'learnerId');
  requireId(memoryId, 'memoryId');
  requireId(key, 'key');
  const memory = { memoryId, learnerId, key, value: structuredClone(value), sourceIds: [...sourceIds], reason, at, scope: 'LONG_TERM' };
  engine.longTerm.set(memoryId, memory);
  return memory;
}

export function getLearnerMemory(engine, learnerId) {
  return [...engine.longTerm.values()].filter(item => item.learnerId === learnerId);
}
