import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadGlobalLearningStrategy,
  validateGlobalLearningStrategy,
  featureEvidenceRecord,
  explainAdaptiveRecommendation,
  PRODUCT_SURFACE_IDS
} from '../src/learning/global-learning-strategy.mjs';

test('frozen strategy validates its critical contract', () => {
  const strategy = loadGlobalLearningStrategy();
  assert.equal(validateGlobalLearningStrategy(strategy).ok, true);
  assert.equal(strategy.governance.noLearningFeatureMayBlockPdfAcquisition, true);
  assert.equal(strategy.languages.canonicalQuranArabicUnchanged, true);
  assert.equal(PRODUCT_SURFACE_IDS.length, 12);
});

test('evidence-to-feature record is explicit and inspectable', () => {
  const record = featureEvidenceRecord({
    feature:'spaced-review',
    pedagogicalMechanism:'retrieval + spacing',
    evidence:['source-1'],
    implementation:['scheduler-registry'],
    evaluationMetric:['delayed-retention'],
    limitations:['domain-dependent effects']
  });
  assert.equal(record.feature,'spaced-review');
  assert.deepEqual(record.evaluationMetric,['delayed-retention']);
});

test('adaptive recommendation exposes why, timing and source', () => {
  const rec = explainAdaptiveRecommendation({
    reasons:['recent-error','prerequisite-gap'],
    source:{sourceId:'book-1',anchor:'page:12'},
    nextReview:'2026-10-01T00:00:00.000Z'
  });
  assert.equal(rec.inspectable,true);
  assert.equal(rec.supportingSource.sourceId,'book-1');
  assert.equal(rec.whyThisActivity,true);
  assert.equal(rec.whyNow,true);
});

test('strategy does not make a game score sufficient for mastery', () => {
  const s = loadGlobalLearningStrategy();
  assert.equal(s.masteryDimensions.includes('transfer'),true);
  assert.equal(s.masteryDimensions.includes('retention'),true);
});
