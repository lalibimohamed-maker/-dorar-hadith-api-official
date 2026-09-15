import test from 'node:test';
import assert from 'node:assert/strict';
import { createLearningMemoryEngine, recordSessionEvent, promoteMemory, getLearnerMemory } from '../src/rechercher-learning-memory-engine.js';
import { createFeedbackLoopEngine, enqueueFeedback, resolveFeedback, pendingFeedback } from '../src/rechercher-feedback-loop-engine.js';
import { createTransferGraphEngine, registerTransferConcept, addTransferEdge, suggestTransfers } from '../src/rechercher-transfer-graph-engine.js';
import { createPedagogySafetyEngine, registerPedagogyPolicy, evaluatePedagogyItem } from '../src/rechercher-pedagogy-safety-engine.js';

test('learning memory separates session events from promoted long-term memory', () => {
  const engine = createLearningMemoryEngine();
  recordSessionEvent(engine, { learnerId: 'l1', sessionId: 's1', eventId: 'e1', type: 'ANSWER', payload: { correct: true } });
  assert.equal(engine.sessions.get('s1').events.length, 1);
  assert.equal(getLearnerMemory(engine, 'l1').length, 0);
  promoteMemory(engine, { learnerId: 'l1', memoryId: 'm1', key: 'level', value: 'beginner', sourceIds: ['src1'] });
  assert.equal(getLearnerMemory(engine, 'l1')[0].scope, 'LONG_TERM');
});

test('feedback loop is bounded and resolved feedback leaves pending queue', () => {
  const engine = createFeedbackLoopEngine({ maxPending: 1 });
  enqueueFeedback(engine, { feedbackId: 'f1', learnerId: 'l1', conceptId: 'c1', promptId: 'p1', answer: 'x' });
  assert.equal(pendingFeedback(engine, 'l1').length, 1);
  assert.throws(() => enqueueFeedback(engine, { feedbackId: 'f2', learnerId: 'l1', conceptId: 'c1', promptId: 'p1', answer: 'y' }), /buffer limit/);
  resolveFeedback(engine, { feedbackId: 'f1', outcome: 'PARTIAL', reviewerRole: 'TEACHER' });
  assert.equal(pendingFeedback(engine, 'l1').length, 0);
});

test('transfer graph only suggests sufficiently confident cross-domain links', () => {
  const engine = createTransferGraphEngine();
  registerTransferConcept(engine, { conceptId: 'c1', domain: 'FIQH', title: 'A', sourceIds: ['s1'] });
  registerTransferConcept(engine, { conceptId: 'c2', domain: 'USUL_AL_FIQH', title: 'B', sourceIds: ['s2'] });
  registerTransferConcept(engine, { conceptId: 'c3', domain: 'ARABIC', title: 'C', sourceIds: ['s3'] });
  addTransferEdge(engine, { edgeId: 'e1', fromConceptId: 'c1', toConceptId: 'c2', confidence: 0.9 });
  addTransferEdge(engine, { edgeId: 'e2', fromConceptId: 'c1', toConceptId: 'c3', confidence: 0.2 });
  assert.deepEqual(suggestTransfers(engine, 'c1', 0.5).map(x => x.conceptId), ['c2']);
});

test('pedagogy safety blocks unknown rights and requires review for blocked evidence states', () => {
  const engine = createPedagogySafetyEngine();
  registerPedagogyPolicy(engine, { policyId: 'p1', name: 'source-grounded' });
  assert.equal(evaluatePedagogyItem(engine, { decisionId: 'd1', policyId: 'p1', evidenceState: 'SOURCE_VERIFIED', rightsStatus: 'UNKNOWN' }).decision, 'BLOCK');
  assert.equal(evaluatePedagogyItem(engine, { decisionId: 'd2', policyId: 'p1', evidenceState: 'AI_GENERATED', rightsStatus: 'ALLOWED' }).decision, 'REVIEW_REQUIRED');
  assert.equal(evaluatePedagogyItem(engine, { decisionId: 'd3', policyId: 'p1', evidenceState: 'AI_GENERATED', rightsStatus: 'ALLOWED', humanReviewed: true }).decision, 'ALLOW');
});
