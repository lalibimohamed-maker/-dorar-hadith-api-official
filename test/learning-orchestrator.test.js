import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateLearningObject,
  buildSelectionDecision,
  scoreLearningItem,
  chooseMode,
  recordLearningEvent,
  updateLearnerFromEvent,
  createLearningTrace,
  createLearningOrchestrator,
  calculateRetrievability,
  masteryEvidence
} from '../src/learning/learning-orchestrator.mjs';
import { fsrsSchedule, sm2Schedule, leitnerSchedule, deadlineAwareSchedule } from '../src/learning/scheduler-registry.mjs';

const baseItem = {
  itemId: 'card-1',
  prompt: 'مثال',
  answer: 'جواب',
  mode: 'free-recall',
  skillIds: ['skill-a'],
  sourceId: 'source-1',
  sourceVerified: true,
  lifecycle: 'source-verified',
  provenance: { sourceId: 'source-1', page: 12 }
};

test('learning objects require immutable source provenance', () => {
  assert.equal(validateLearningObject(baseItem).ok, true);
  assert.equal(validateLearningObject({ ...baseItem, provenance: { sourceId: 'source-1' } }).ok, false);
});

test('selection is multi-objective and explainable', () => {
  const decision = buildSelectionDecision({
    item: baseItem,
    candidates: [
      { ...baseItem, itemId: 'card-2', sourceId: 'source-2', skillIds: ['skill-b'], due: true, retrievability: 0.1, provenance: { sourceId: 'source-2', anchor: 'ayah:2:255' } }
    ],
    profile: { contextKey: 'tafsir', masteryBySkill: { 'skill-a': 0.8, 'skill-b': 0.2 }, sourceCounts: { 'source-2': 0 } },
    now: '2026-09-28T10:00:00.000Z'
  });
  assert.equal(decision.itemId, 'card-2');
  assert.equal(decision.confidencePrompt, true);
  assert.ok(decision.reason.length > 0);
  assert.equal(decision.acquisitionIndependent, true);
});

test('scheduler families share one contract', () => {
  const now = '2026-09-28T10:00:00.000Z';
  for (const result of [
    fsrsSchedule({ grade: 'good', now }),
    sm2Schedule({ grade: 'good', now }),
    leitnerSchedule({ grade: 'good', now }),
    deadlineAwareSchedule({ grade: 'good', now, deadlineAt: '2026-09-29T00:00:00.000Z' })
  ]) {
    assert.ok(result.nextReviewAt > now);
    assert.ok(result.state);
  }
});

test('FSRS-shaped state exposes retrievability, stability and difficulty', () => {
  const result = fsrsSchedule({ grade: 'easy', now: '2026-09-28T10:00:00.000Z' });
  assert.equal(result.algorithmFamily, 'fsrs');
  assert.equal(typeof result.state.stabilityDays, 'number');
  assert.equal(typeof result.state.difficulty, 'number');
  assert.equal(typeof result.state.retrievability, 'number');
  assert.equal(result.canonicalImplementation, false);
});

test('confidence and correctness remain separate event signals', () => {
  const event = recordLearningEvent({
    itemId: 'card-1', sourceId: 'source-1', skillIds: ['skill-a'],
    correctness: false, confidence: 0.9, mode: 'free-recall', nextReview: '2026-09-28T12:00:00.000Z'
  });
  assert.equal(event.correctness, false);
  assert.equal(event.confidence, 0.9);
  assert.notEqual(event.correctness, event.confidence);
});

test('mode selection routes repeated errors toward remediation', () => {
  const mode = chooseMode(baseItem, { errorCounts: { 'card-1': 3 }, confidenceByItem: { 'card-1': 0.5 } });
  assert.equal(mode.mode, 'error-correction');
});

test('learner update records evidence without using confidence as correctness', () => {
  const next = updateLearnerFromEvent(
    { masteryBySkill: { 'skill-a': 0.5 } },
    { itemId:'card-1', sourceId:'source-1', skillIds:['skill-a'], correctness:false, confidence:0.95, mode:'free-recall' }
  );
  assert.ok(next.masteryBySkill['skill-a'] < 0.5);
  assert.equal(next.confidenceByItem['card-1'], 0.95);
});

test('trace is source-to-follow-up complete', () => {
  const trace = createLearningTrace({
    source: { sourceId:'source-1', anchor:'page:12' },
    learningObject: baseItem,
    decision: { itemId:'card-1', reason:['due'] },
    event: { correctness:true, confidence:0.7 },
    followUp: { nextReview:'2026-10-01T00:00:00.000Z' }
  });
  assert.equal(trace.source.sourceId, 'source-1');
  assert.equal(trace.selection.itemId, 'card-1');
  assert.equal(trace.response.correctness, true);
  assert.equal(trace.followUp.nextReview.startsWith('2026-'), true);
});

test('scheduler state is isolated per learner and content context', () => {
  const engine = createLearningOrchestrator({ scheduler: 'fsrs' });
  engine.schedule('card-1', { learnerId:'learner-a', contextKey:'hadith' }, 'good', { now:'2026-09-28T10:00:00.000Z' });
  assert.ok(engine.getContextState('hadith', 'learner-a')['card-1']);
  assert.deepEqual(engine.getContextState('hadith', 'learner-b'), {});
  assert.deepEqual(engine.getContextState('fiqh', 'learner-a'), {});
});

test('retrievability decreases as elapsed time grows', () => {
  assert.ok(calculateRetrievability({ stabilityDays: 10, elapsedDays: 5 }) > calculateRetrievability({ stabilityDays: 10, elapsedDays: 20 }));
});

test('mastery requires delayed or transfer evidence', () => {
  assert.equal(masteryEvidence({ mastery:0.9, delayedAssessments:0, transferAssessments:0 }).eligible, false);
  assert.equal(masteryEvidence({ mastery:0.9, delayedAssessments:1, transferAssessments:0 }).eligible, true);
});
