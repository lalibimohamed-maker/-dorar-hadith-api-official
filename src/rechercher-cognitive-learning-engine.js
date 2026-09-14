import { buildLearningDecision, diagnosePerformance, updateAfterAttempt, evaluateTransfer } from './learning/rechercher-learning-intelligence-engine.mjs';
import { createLearningMemoryEngine, recordSessionEvent, promoteMemory, getLearnerMemory } from './rechercher-learning-memory-engine.js';
import { createFeedbackLoopEngine, enqueueFeedback, resolveFeedback, pendingFeedback } from './rechercher-feedback-loop-engine.js';
import { createTransferGraphEngine, suggestTransfers } from './rechercher-transfer-graph-engine.js';
import { createPedagogySafetyEngine, evaluatePedagogyItem } from './rechercher-pedagogy-safety-engine.js';

export const COGNITIVE_STAGES = Object.freeze(['UNDERSTAND', 'PRACTICE', 'RETRIEVE', 'FEEDBACK', 'MASTERY', 'TRANSFER', 'REPLAN']);

export function createCognitiveLearningEngine({ memory = {}, feedback = {}, learner = {}, transferGraph = null, pedagogySafety = null } = {}) {
  return {
    memory: createLearningMemoryEngine(memory),
    feedback: createFeedbackLoopEngine(feedback),
    learner: { ...learner },
    transferGraph: transferGraph ?? createTransferGraphEngine(),
    pedagogySafety: pedagogySafety ?? createPedagogySafetyEngine(),
    sessions: new Map()
  };
}

function requireId(value, name) {
  if (!value) throw new TypeError(`${name} is required`);
}

function memoryEvent(engine, session, type, payload, at) {
  return recordSessionEvent(engine.memory, {
    learnerId: session.learnerId,
    sessionId: session.sessionId,
    eventId: `${session.sessionId}:${session.events.length + 1}`,
    type,
    payload,
    at
  });
}

export function startCognitiveSession(engine, { sessionId, learnerId, itemId, sourceIds = [], now = new Date().toISOString() } = {}) {
  requireId(sessionId, 'sessionId');
  requireId(learnerId, 'learnerId');
  const session = { sessionId, learnerId, itemId: itemId ?? null, sourceIds: [...new Set(sourceIds)], stage: 'UNDERSTAND', startedAt: now, events: [] };
  engine.sessions.set(sessionId, session);
  memoryEvent(engine, session, 'SESSION_STARTED', { itemId: session.itemId, sourceIds: session.sourceIds }, now);
  return session;
}

export function advanceCognitiveStage(engine, sessionId, stage, { reason = 'progress', now = new Date().toISOString() } = {}) {
  const session = engine.sessions.get(sessionId);
  requireId(session, 'session');
  if (!COGNITIVE_STAGES.includes(stage)) throw new RangeError(`unsupported cognitive stage: ${stage}`);
  const current = COGNITIVE_STAGES.indexOf(session.stage);
  const target = COGNITIVE_STAGES.indexOf(stage);
  if (target < current) throw new RangeError('cognitive stages cannot move backwards');
  session.stage = stage;
  const event = { type: 'STAGE_ADVANCED', stage, reason, at: now };
  session.events.push(event);
  memoryEvent(engine, session, event.type, { stage, reason }, now);
  return session;
}

export function processCognitiveAttempt(engine, sessionId, attempt = {}, { state = {}, sourceIds = [], now = new Date().toISOString() } = {}) {
  const session = engine.sessions.get(sessionId);
  requireId(session, 'session');
  const diagnosis = diagnosePerformance(attempt);
  const nextState = updateAfterAttempt(state, attempt);
  const decision = buildLearningDecision({ itemId: session.itemId, skillIds: attempt.skillIds ?? [], sourceIds: [...new Set([...session.sourceIds, ...sourceIds])], state: nextState, now });
  const feedbackId = `${sessionId}:${session.events.length + 1}`;
  enqueueFeedback(engine.feedback, { feedbackId, learnerId: session.learnerId, conceptId: attempt.conceptId ?? session.itemId ?? 'unknown', promptId: attempt.promptId ?? session.itemId ?? 'unknown', answer: attempt.answer, evidenceSourceIds: decision.sourceIds });
  const event = { type: 'ATTEMPT_PROCESSED', diagnosis, decision, feedbackId, at: now };
  session.events.push(event);
  memoryEvent(engine, session, event.type, event, now);
  return { diagnosis, nextState, decision, feedbackId };
}

export function completeCognitiveFeedback(engine, feedbackId, { outcome, reviewerRole = 'SYSTEM', note = '' } = {}) {
  return resolveFeedback(engine.feedback, { feedbackId, outcome, reviewerRole, note });
}

export function promoteCognitiveMemory(engine, { learnerId, memoryId, key, value, sourceIds = [], reason = '' } = {}) {
  return promoteMemory(engine.memory, { learnerId, memoryId, key, value, sourceIds, reason });
}

export function buildCognitivePlan(engine, { learnerId, conceptId, state = {}, sourceIds = [], pedagogyItem = {}, minTransferConfidence = 0.6 } = {}) {
  const memories = getLearnerMemory(engine.memory, learnerId);
  const transfers = conceptId && engine.transferGraph.concepts.has(conceptId)
    ? suggestTransfers(engine.transferGraph, conceptId, minTransferConfidence)
    : [];
  const safety = pedagogyItem.policyId
    ? evaluatePedagogyItem(engine.pedagogySafety, pedagogyItem)
    : { decision: 'REVIEW_REQUIRED', reason: 'pedagogy-policy-not-supplied' };
  return {
    stages: [...COGNITIVE_STAGES],
    decision: buildLearningDecision({ itemId: pedagogyItem.itemId ?? conceptId, sourceIds, state }),
    memory: memories,
    transfers,
    safety,
    pendingFeedback: pendingFeedback(engine.feedback, learnerId)
  };
}

export function evaluateCognitiveTransfer(input = {}) {
  return evaluateTransfer(input);
}
