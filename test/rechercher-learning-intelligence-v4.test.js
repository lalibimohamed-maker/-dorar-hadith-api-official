import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_FEEDBACK_BUFFER_LIMIT,
  V4_VERSION,
  appendFeedback,
  appendSessionEvent,
  chooseLearningAction,
  createLongTermLearnerProfile,
  createSessionMemory,
  createTransferRoute,
  evaluatePedagogicalSafety,
  evaluateTransferRoute,
  learningIntelligenceV4Policy,
  persistLongTermMemory,
  summarizeSession
} from '../src/learning/rechercher-learning-intelligence-v4.mjs';

test('v4 is additive and keeps acquisition non-blocking', () => {
  const policy = learningIntelligenceV4Policy();
  assert.equal(V4_VERSION, '4.0.0');
  assert.equal(policy.learningMayNotBlockPdfAcquisition, true);
  assert.equal(policy.acquisitionBlocking, false);
});

test('session memory captures transient learning signals before durability', () => {
  let session = createSessionMemory({ sessionId: 's1', learnerId: 'l1' });
  session = appendSessionEvent(session, { skillId: 'skill-1', correct: false, sourceIds: ['src-1'] });
  session = appendSessionEvent(session, { skillId: 'skill-1', correct: true, sourceIds: ['src-1'] });
  const summary = summarizeSession(session);
  assert.equal(summary.eventCount, 2);
  assert.equal(summary.errors, 1);
  assert.equal(summary.successes, 1);
  assert.equal(session.durablePersistencePrepared, false);
});

test('feedback buffer is bounded', () => {
  let session = createSessionMemory({ sessionId: 's2' });
  for (let i = 0; i < DEFAULT_FEEDBACK_BUFFER_LIMIT + 10; i += 1) {
    session = appendFeedback(session, { kind: 'hint', index: i });
  }
  assert.equal(session.feedbackBuffer.length, DEFAULT_FEEDBACK_BUFFER_LIMIT);
  assert.equal(session.feedbackBuffer.at(-1).index, DEFAULT_FEEDBACK_BUFFER_LIMIT + 9);
});

test('long-term memory persists summaries rather than raw session events', () => {
  const session = createSessionMemory({ sessionId: 's3', learnerId: 'l2' });
  const summary = summarizeSession(session);
  const durable = persistLongTermMemory({}, summary, { maxEntries: 2 });
  assert.equal(durable.sessionSummariesOnly, true);
  assert.equal(durable.rawSessionEventsPersisted, false);
  assert.equal(durable.rawFeedbackPersisted, false);
});

test('learner profile remains evidence-minimal and separate from raw session memory', () => {
  const profile = createLongTermLearnerProfile({
    learnerId: 'l3',
    mastery: { skillA: 0.7 },
    preferredModality: 'text'
  });
  assert.equal(profile.mastery.skillA, 0.7);
  assert.equal(profile.rawSessionData, false);
  assert.equal(profile.rawFeedbackData, false);
});

test('transfer is represented explicitly and requires evidence support', () => {
  const route = createTransferRoute({
    id: 't1',
    sourceSkillId: 'skill-a',
    targetSkillId: 'skill-b',
    sourceEvidenceIds: ['e-a'],
    targetEvidenceIds: ['e-b']
  });
  assert.equal(route.explicit, true);
  assert.equal(evaluateTransferRoute(route, [{ verified: true, provenanceId: 'p1', skillId: 'skill-a' }]).status, 'needs_review');
  assert.equal(evaluateTransferRoute(route, [
    { verified: true, provenanceId: 'p1', skillId: 'skill-a' },
    { verified: true, provenanceId: 'p2', skillId: 'skill-b' }
  ]).status, 'evidence_supported');
});

test('direct answers are constrained when retrieval effort should be preserved', () => {
  const guided = chooseLearningAction({
    retrievalEffort: 0.8,
    shouldPreserveRetrieval: true,
    requestedDirectAnswer: true,
    evidenceAvailable: true
  });
  assert.equal(guided.answerMode, 'guided-retrieval-first');
  assert.equal(guided.directAnswerConstrained, true);

  const direct = chooseLearningAction({
    retrievalEffort: 0.0,
    shouldPreserveRetrieval: false,
    requestedDirectAnswer: true,
    evidenceAvailable: true
  });
  assert.equal(direct.answerMode, 'direct-answer-with-evidence');
});

test('pedagogical safety blocks unsupported or authority-seeking generation', () => {
  const unsafe = evaluatePedagogicalSafety({
    sourceGrounded: false,
    uncertaintyExplicit: false,
    retrievalPreserved: false,
    generatedClaim: true,
    autonomousAuthorityRequested: true
  });
  assert.equal(unsafe.safe, false);
  assert.equal(unsafe.acquisitionBlocking, false);

  const safe = evaluatePedagogicalSafety({
    sourceGrounded: true,
    uncertaintyExplicit: true,
    retrievalPreserved: true
  });
  assert.equal(safe.safe, true);
});

test('session event append preserves existing data', () => {
  const s = createSessionMemory({ sessionId: 's4', sourceIds: ['x'] });
  const next = appendSessionEvent(s, { skillId: 'k' });
  assert.deepEqual(next.sourceIds, ['x']);
  assert.equal(next.events.length, 1);
});
