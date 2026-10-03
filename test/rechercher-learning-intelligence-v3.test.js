import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canLearningFailureBlockAcquisition,
  confidenceCalibration,
  createLearnerProfile,
  createSourceGroundedLearningObject,
  diagnoseLearner,
  evaluateLearningIntervention,
  getLearningMethodRegistry,
  recordLearningOutcome,
  selectNextActivity,
} from '../src/rechercher-learning-intelligence-v3.js';

const evidence = [{ sourceId: 'bukhari', citation: 'vol1:p1', verificationState: 'edition_verified', rights: 'source-dependent' }];

test('method registry is versioned and measurable', () => {
  const registry = getLearningMethodRegistry();
  assert.equal(registry.retrieval.version, '1.0.0');
  assert.ok(registry.retrieval.measures.includes('delayed_retention'));
  assert.equal(registry.game.measures.includes('immediate_accuracy'), false);
});

test('learner profile is explainable and minimizes data', () => {
  const profile = createLearnerProfile({
    learnerId: 'local-user',
    interfaceLanguage: 'fr',
    learningLanguage: 'fr',
    preferredModality: 'text'
  });
  assert.equal(profile.interfaceLanguage, 'fr');
  assert.equal(profile.learningLanguage, 'fr');
  assert.equal(profile.sensitiveProfiling, false);
  assert.deepEqual(profile.mastery, {});
});

test('outcomes keep correctness separate from confidence', () => {
  let state = createLearnerProfile();
  state = recordLearningOutcome(state, { skill: 'hadith:source', correct: false, confidence: 0.95 });
  const calibration = confidenceCalibration(state, 'hadith:source');
  assert.equal(calibration.meanCorrect, 0);
  assert.equal(calibration.meanConfidence, 0.95);
  assert.equal(calibration.overconfidenceRisk, 0.95);
});

test('diagnosis can route to a weak prerequisite before repetition', () => {
  const state = createLearnerProfile({
    mastery: { advanced: 0.35 },
    prerequisites: { advanced: { gap: 0.8 } },
    retrievalStrength: { advanced: 0.2 }
  });
  const diagnosis = diagnoseLearner({ skill: 'advanced', state });
  const next = selectNextActivity(diagnosis);
  assert.equal(next.method, 'reading');
  assert.deepEqual(next.reason, ['prerequisite-gap']);
  assert.equal(next.acquisitionBlocking, false);
});

test('source-grounded learning objects require verified passages', () => {
  const item = createSourceGroundedLearningObject({
    id: 'lesson-1',
    method: 'retrieval',
    sourcePassages: evidence,
    conceptIds: ['c1'],
    generatedAssistance: 'AI explanation'
  });
  assert.equal(item.generatedIsEvidence, false);
  assert.equal(item.canonicalCorpusMutation, false);
  assert.throws(() => createSourceGroundedLearningObject({
    id: 'bad',
    sourcePassages: [{ sourceId: 'x', citation: 'x', verificationState: 'pending_verification' }]
  }), /verified source-grounded passages/);
});

test('continuous evaluation records immediate, delayed and transfer outcomes', () => {
  const outcome = evaluateLearningIntervention({
    immediateAccuracy: 0.9,
    delayedAccuracy: 0.82,
    transferAccuracy: 0.76,
    confidenceBias: 0.15
  });
  assert.equal(outcome.durableLearningMeasured, true);
  assert.equal(outcome.transferAccuracy, 0.76);
  assert.equal(outcome.acquisitionBlocking, false);
});

test('learning failure can never block acquisition', () => {
  assert.equal(canLearningFailureBlockAcquisition(), false);
  assert.equal(
    selectNextActivity(
      { mastery: 0, retrievalRisk: 1, prerequisiteGap: 1, calibration: { overconfidenceRisk: 0 } },
      { sourceAvailable: false }
    ).acquisitionBlocking,
    false
  );
});
