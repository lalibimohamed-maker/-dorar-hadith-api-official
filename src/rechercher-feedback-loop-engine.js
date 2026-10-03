export const FEEDBACK_OUTCOMES = Object.freeze(['CORRECT', 'PARTIAL', 'INCORRECT', 'UNCERTAIN']);

export function createFeedbackLoopEngine({ maxPending = 1000 } = {}) {
  if (maxPending < 1) throw new RangeError('maxPending must be positive');
  return { maxPending, items: new Map(), outcomes: new Map() };
}

export function enqueueFeedback(engine, { feedbackId, learnerId, conceptId, promptId, answer, evidenceSourceIds = [], at = new Date().toISOString() } = {}) {
  if (!feedbackId || !learnerId || !conceptId || !promptId) throw new TypeError('feedback requires identity, learner and concept');
  if (engine.items.size >= engine.maxPending) throw new Error('feedback buffer limit reached');
  const item = { feedbackId, learnerId, conceptId, promptId, answer, evidenceSourceIds: [...evidenceSourceIds], at, state: 'PENDING' };
  engine.items.set(feedbackId, item);
  return item;
}

export function resolveFeedback(engine, { feedbackId, outcome, reviewerRole = 'SYSTEM', note = '' } = {}) {
  if (!engine.items.has(feedbackId)) throw new Error(`Unknown feedback: ${feedbackId}`);
  if (!FEEDBACK_OUTCOMES.includes(outcome)) throw new TypeError(`Unknown feedback outcome: ${outcome}`);
  const item = engine.items.get(feedbackId);
  item.state = 'RESOLVED';
  item.outcome = outcome;
  item.reviewerRole = reviewerRole;
  item.note = note;
  engine.outcomes.set(feedbackId, item);
  return item;
}

export function pendingFeedback(engine, learnerId = null) {
  return [...engine.items.values()].filter(item => item.state === 'PENDING' && (!learnerId || item.learnerId === learnerId));
}
