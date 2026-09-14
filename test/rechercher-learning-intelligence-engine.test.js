import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEARNING_LOOP,
  createLearnerState,
  diagnosePerformance,
  selectLearningMethod,
  selectNextItem,
  scheduleReview,
  evaluateTransfer,
  runLearningCycle,
  getLearningEngineCapabilities
} from '../src/learning/rechercher-learning-intelligence-engine.mjs';

test('learning loop contains the complete adaptive cycle', () => {
  assert.deepEqual(LEARNING_LOOP, ['know','forget','error','prerequisite','select_method','render','feedback','wait','retest','transfer','replan']);
});

test('learner state separates mastery, retrievability and confidence', () => {
  const state = createLearnerState({ mastery: 0.4, retrievability: 0.2, confidence: 0.9 });
  assert.equal(state.mastery, 0.4);
  assert.equal(state.retrievability, 0.2);
  assert.equal(state.confidenceGap, 0.5);
});

test('diagnosis identifies overconfidence and missing prerequisite', () => {
  const result = diagnosePerformance({ correct: false, confidence: 0.9, prerequisiteMissing: true });
  assert.ok(result.reasons.includes('misconception-or-overconfidence'));
  assert.ok(result.reasons.includes('missing-prerequisite'));
});

test('method selection routes prerequisite gaps before ordinary practice', () => {
  const result = selectLearningMethod({ mastery: 0.2, missingPrerequisiteIds: ['skill-a'] }, { candidates: ['free-recall', 'source-match'] });
  assert.equal(result.mode, 'source-match');
});

test('item selection prioritizes retrieval and mastery gaps', () => {
  const result = selectNextItem([
    { id: 'strong', mastery: 0.9, retrievability: 0.9 },
    { id: 'weak', mastery: 0.1, retrievability: 0.1, novelty: 0.2 }
  ], { mastery: 0.5, retrievability: 0.5 });
  assert.equal(result.id, 'weak');
});

test('scheduler returns a future review without binding the engine to one algorithm', () => {
  const result = scheduleReview({ retrievability: 0.5, difficulty: 0.5, correct: true, now: '2026-01-01T00:00:00.000Z' });
  assert.ok(result.nextReviewAt > '2026-01-01T00:00:00.000Z');
  assert.deepEqual(result.compatibleBackends, ['FSRS','SM-2','Leitner','forgetting-curve']);
});

test('transfer requires novel context and adequate explanation', () => {
  assert.equal(evaluateTransfer({ correct: true, confidence: 0.8, novelContext: true, explanationQuality: 0.7 }).transferred, true);
  assert.equal(evaluateTransfer({ correct: true, confidence: 0.8, novelContext: false, explanationQuality: 0.7 }).transferred, false);
});

test('cycle produces diagnosis, updated state and next action', () => {
  const result = runLearningCycle({
    state: { mastery: 0.4, retrievability: 0.3, confidence: 0.8 },
    attempt: { correct: false, confidence: 0.8 },
    items: [{ id: 'a', mastery: 0.1, retrievability: 0.1 }]
  });
  assert.equal(result.acquisitionIndependent, true);
  assert.ok(result.diagnosis.reasons.length > 0);
  assert.ok(result.next.item);
});

test('capabilities explicitly state learning cannot block acquisition', () => {
  const capabilities = getLearningEngineCapabilities();
  assert.equal(capabilities.acquisitionBlocking, false);
  assert.equal(capabilities.sourceGroundingRequiredForReligiousAnswers, true);
  assert.ok(capabilities.renderers.includes('game'));
});
