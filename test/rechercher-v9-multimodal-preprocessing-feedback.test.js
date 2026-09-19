import test from 'node:test';
import assert from 'node:assert/strict';
import {
  V9_ENGINE_ADAPTERS,
  createV9StageNodeContract,
  createV9MultimodalRecitationEngine,
  registerMediaIdentity,
  preprocessModality,
  extractModalityFeatures,
  fuseModalities,
  registerSourceIdentity,
  applyGuardrails,
  submitHumanReview,
  recordFeedback,
  runActiveLearningCycle,
} from '../src/rechercher-v9-multimodal-recitation-engine.js';

test('V9 exposes preprocessing, fusion, guardrails and feedback capabilities', () => {
  const contract = createV9StageNodeContract();
  assert.ok(contract.capabilities.includes('PREPROCESSING_NORMALIZATION'));
  assert.ok(contract.capabilities.includes('FEATURE_EXTRACTION'));
  assert.ok(contract.capabilities.includes('SIGNAL_ALIGNMENT'));
  assert.ok(contract.capabilities.includes('MODALITY_FUSION'));
  assert.ok(contract.capabilities.includes('ACTIVE_LEARNING_FEEDBACK_LOOP'));
  assert.ok(contract.capabilities.includes('RIGHTS_PRIVACY_USAGE_GUARDRAILS'));
  assert.equal(contract.safety.canMutateCanonicalQuranArabic, false);
  assert.equal(contract.safety.canMutateOriginalPdf, false);
});

test('V9 adapter registry identifies the complete multimodal toolchain', () => {
  assert.ok(V9_ENGINE_ADAPTERS.MEDIA_NORMALIZER.includes('FFmpeg'));
  assert.ok(V9_ENGINE_ADAPTERS.PDF_IMAGE_TEXT.includes('PDFium'));
  assert.ok(V9_ENGINE_ADAPTERS.OCR.includes('Tesseract'));
  assert.ok(V9_ENGINE_ADAPTERS.ASR.includes('faster-whisper'));
  assert.ok(V9_ENGINE_ADAPTERS.FORCED_ALIGNMENT.includes('Montreal Forced Aligner'));
  assert.ok(V9_ENGINE_ADAPTERS.CROSS_MODAL_EMBEDDINGS.includes('Sentence Transformers'));
});

test('V9 preprocesses and extracts features before modality fusion', () => {
  const engine = createV9MultimodalRecitationEngine();
  registerMediaIdentity(engine, { mediaId: 'audio1', modality: 'AUDIO', mimeType: 'audio/wav', contentHash: 'ha' });
  registerMediaIdentity(engine, { mediaId: 'image1', modality: 'IMAGE', mimeType: 'image/png', contentHash: 'hi' });
  preprocessModality(engine, { mediaId: 'audio1', targetFormat: 'wav/16k/mono', preprocessingSteps: ['decode', 'resample', 'denoise', 'segment'] });
  preprocessModality(engine, { mediaId: 'image1', targetFormat: 'png/rgb', preprocessingSteps: ['decode', 'orientation', 'normalize'] });
  extractModalityFeatures(engine, { mediaId: 'audio1', extractor: 'librosa', featureType: 'mel+mfcc', dimensions: 80 });
  extractModalityFeatures(engine, { mediaId: 'image1', extractor: 'OpenCV', featureType: 'visual', dimensions: 512 });
  const fused = fuseModalities(engine, { fusionId: 'fusion1', mediaIds: ['audio1', 'image1'], method: 'WEIGHTED_EVIDENCE_FUSION', confidence: 0.82 });
  assert.equal(fused.reviewState, 'CANDIDATE');
  assert.equal(engine.mediaBundles.get('audio1').fused, 'fusion1');
});

test('V9 guardrails stop restricted publication, privacy exposure and canonical mutation', () => {
  const engine = createV9MultimodalRecitationEngine();
  registerSourceIdentity(engine, { source_id: 'restricted', work_id: 'w1', edition_id: 'e1', manifestation_id: 'm1', language: 'ar', rights: 'RESTRICTED', provenance: { provider: 'test' }, retrieval_date: '2026-09-17', content_hash: 'h1' });
  assert.throws(() => applyGuardrails(engine, { operationId: 'op1', sourceId: 'restricted', action: 'PUBLISH' }), /RIGHTS_NOT_PUBLISHABLE/);
  assert.throws(() => applyGuardrails(engine, { operationId: 'op2', sourceId: 'restricted', action: 'EXPOSE', privateData: true }), /PRIVATE_DATA_EXPOSURE/);
  assert.throws(() => applyGuardrails(engine, { operationId: 'op3', sourceId: 'restricted', action: 'READ', canonicalMutation: true }), /CANONICAL_QURAN_MUTATION/);
});

test('V9 human review produces reusable feedback but never auto-deploys a model', () => {
  const engine = createV9MultimodalRecitationEngine();
  const review = submitHumanReview(engine, { reviewId: 'r1', targetId: 'alignment1', reviewerId: 'scholar1', state: 'VERIFIED', corrections: [{ from: 'x', to: 'y' }] });
  assert.equal(review.state, 'VERIFIED');
  const feedback = recordFeedback(engine, { feedbackId: 'f1', targetId: 'alignment1', reviewerId: 'scholar1', type: 'ALIGNMENT_CORRECTION', before: { value: 'x' }, after: { value: 'y' } });
  assert.equal(feedback.accepted, true);
  const cycle = runActiveLearningCycle(engine, { cycleId: 'cycle1', modelVersionBefore: 'm1' });
  assert.equal(cycle.sampleCount, 1);
  assert.equal(cycle.evaluationRequired, true);
  assert.equal(cycle.deploymentAllowed, false);
});
