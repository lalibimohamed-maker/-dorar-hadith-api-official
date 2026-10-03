import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createV5CognitiveEngine,
  recordConcept,
  observeAttempt,
  beginLearningSession,
  endLearningSession,
  estimateRetention,
  recordInterventionOutcome,
  detectStrategyFailure,
  recordKnowledgeActionGap,
  versionLearnerModel
} from '../src/rechercher-v5-cognitive-learning-intelligence-engine.js';

test('V5 tracks session state, retention and learner model versions', () => {
  let now = Date.parse('2026-09-14T00:00:00Z');
  const engine = createV5CognitiveEngine({ now: () => now, retentionHalfLifeHours: 72 });
  recordConcept(engine, { conceptId: 'c1', mastery: 0.6, masteryUncertainty: 0.2 });
  const session = beginLearningSession(engine, { sessionId: 's1', fatigueStart: 0.1 });
  observeAttempt(engine, 'c1', { correct: true, confidence: 0.8, sessionId: session.sessionId });
  now += 72 * 3600000;
  const retention = estimateRetention(engine, 'c1');
  assert.ok(retention.retention <= 0.51 && retention.retention >= 0.49);
  const ended = endLearningSession(engine, 's1', { fatigueEnd: 0.5 });
  assert.equal(ended.fatigueDelta, 0.4);
  assert.equal(versionLearnerModel(engine, 'calibration update').version, 2);
});

test('V5 detects repeated intervention failure and knowledge-action gap', () => {
  const engine = createV5CognitiveEngine();
  recordConcept(engine, { conceptId: 'c2' });
  recordInterventionOutcome(engine, 'c2', { intervention: 'EXPLAIN', outcome: 0.2 });
  recordInterventionOutcome(engine, 'c2', { intervention: 'EXPLAIN', outcome: 0.1 });
  assert.equal(detectStrategyFailure(engine, 'c2'), true);
  assert.equal(recordKnowledgeActionGap(engine, 'c2', { knowledgeCorrect: true, actionCorrect: false }), true);
});
