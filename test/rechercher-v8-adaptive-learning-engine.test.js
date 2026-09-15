import test from 'node:test';
import { strict as assert } from 'node:assert';
import {
  LEARNING_STAGES,
  createLearnerState,
  observeSkill,
  diagnoseLearner,
  chooseDifficulty,
  selectAction,
  chooseSource,
  scheduleNextReview,
  buildAdaptivePlan,
  advanceLearningPlan,
  canAdaptiveLearningDeclareMastery,
  createV8AdaptiveLearningEngine,
} from '../src/rechercher-v8-adaptive-learning-engine.js';

test('V8 models learner knowledge, prerequisites and misconceptions', () => {
  const graph = { edges: [
    { from: 'basics', to: 'fiqh', relation: 'requires', confidence: 0.95 },
    { from: 'fiqh', to: 'mis1', relation: 'confused_with', confidence: 0.9 },
  ] };
  let state = createLearnerState({ learnerId: 'l1', skills: { basics: { mastery: 0.3 }, fiqh: { mastery: 0.2 } } });
  state = observeSkill(state, 'fiqh', { correct: false, confidence: 0.9 });
  const diagnosis = diagnoseLearner({ graph, state, skillId: 'fiqh', result: { correct: false, confidence: 0.9 } });
  assert.equal(diagnosis.prerequisiteGaps[0].skillId, 'basics');
  assert.equal(diagnosis.misconception.skillId, 'mis1');
  assert.equal(diagnosis.needsIntervention, true);
});

test('V8 chooses difficulty and learning action from evidence about the learner', () => {
  assert.equal(chooseDifficulty({ mastery: 0.1, confidence: 0.5 }), 'FOUNDATION');
  assert.equal(selectAction({ prerequisiteGaps: [{ skillId: 'x' }], mastery: 0 }, { lastCorrect: false }), 'REVIEW_PREREQUISITE');
  assert.equal(selectAction({ prerequisiteGaps: [], misconception: null, mastery: 0.4 }, { lastCorrect: false }), 'SHOW_EXAMPLE');
  assert.equal(selectAction({ prerequisiteGaps: [], misconception: null, mastery: 0.7 }, { lastCorrect: true, transferScore: 0.4 }), 'TRANSFER_PRACTICE');
});

test('V8 selects only rights-allowed, source-grounded learning sources', () => {
  const sources = chooseSource({ sources: [
    { sourceId: 'bad', rightsStatus: 'UNKNOWN', evidenceState: 'SOURCE_VERIFIED', provenance: { provider: 'x' }, relevance: 1 },
    { sourceId: 'ai', rightsStatus: 'ALLOWED', evidenceState: 'AI_SYNTHESIS', provenance: { provider: 'x' }, relevance: 2 },
    { sourceId: 'good', rightsStatus: 'ALLOWED', evidenceState: 'SCHOLAR_REVIEWED', provenance: { provider: 'library' }, relevance: 0.9 },
  ] });
  assert.deepEqual(sources.map(source => source.sourceId), ['good']);
});

test('V8 produces staged autonomous plan without religious decision authority', () => {
  const plan = buildAdaptivePlan({
    graph: { edges: [] },
    state: createLearnerState({ learnerId: 'l1', skills: { aqidah: { mastery: 0.2, confidence: 0.5, attempts: 2 } } }),
    skillId: 'aqidah',
    result: { correct: false, confidence: 0.8 },
    sources: [{ sourceId: 's1', rightsStatus: 'ALLOWED', evidenceState: 'SOURCE_VERIFIED', provenance: { provider: 'official' }, relevance: 1 }],
    goal: 'understand',
  });
  assert.equal(plan.version, '8.0.0');
  assert.equal(plan.religiousAuthority, 'UNCHANGED_SOURCE_AND_SCHOLAR_REVIEW_POLICY');
  assert.equal(plan.acquisitionIndependent, true);
  assert.equal(plan.recommendedSource.sourceId, 's1');
});

test('V8 advances through diagnose to retrieval, transfer, test and mastery gates', () => {
  let plan = { skillId: 'x', nextStage: 'DIAGNOSE', action: 'RETRIEVAL_PRACTICE' };
  for (const stage of LEARNING_STAGES.slice(1, 5)) {
    plan = advanceLearningPlan(plan, { correct: true, score: 0.9, transferScore: 0.8 });
    assert.ok(LEARNING_STAGES.includes(plan.nextStage));
  }
  assert.equal(canAdaptiveLearningDeclareMastery({ plan: { nextStage: 'TEST' }, score: 0.9, transferScore: 0.8, sourceVerified: true, humanReviewRequired: false }), true);
  assert.equal(canAdaptiveLearningDeclareMastery({ plan: { nextStage: 'TEST' }, score: 0.9, transferScore: 0.8, sourceVerified: false, humanReviewRequired: false }), false);
});

test('V8 schedules spaced review and keeps acquisition independent', () => {
  const review = scheduleNextReview({ mastery: 0.4, difficulty: 'GUIDED', now: '2026-09-15T00:00:00Z' });
  assert.equal(review.days, 1);
  const engine = createV8AdaptiveLearningEngine({ learner: { learnerId: 'l1' } });
  assert.equal(engine.policy.religiousDecisionAuthority, false);
  assert.equal(engine.policy.acquisitionIndependent, true);
});
