import test from 'node:test';
import assert from 'node:assert/strict';
import { V9_OPERATIONAL_PIPELINE, applyV9Guardrails, createV9FeedbackEvent, buildV9ActiveLearningBatch, evaluateV9FeedbackImpact, runV9MultimodalLearningCase } from '../src/rechercher-v9-multimodal-learning-orchestrator.js';

test('V9 operational pipeline contains the full multimodal learning lifecycle', () => {
  assert.deepEqual(V9_OPERATIONAL_PIPELINE, ['MEDIA_IDENTITY','PREPROCESSING','FEATURE_EXTRACTION','PROVENANCE','ALIGNMENT','MODALITY_FUSION','RECITATION_INTELLIGENCE','CANDIDATE_FINDING','GUARDRAILS','HUMAN_REVIEW','VERIFICATION','FEEDBACK','ACTIVE_LEARNING','ADAPTIVE_MEMORIZATION']);
});

test('rights and privacy guardrails block publication when permission is unknown or restricted', () => {
  const restricted = applyV9Guardrails({ rights: 'UNKNOWN' });
  assert.equal(restricted.publishable, false);
  assert.equal(restricted.sourceMutationAllowed, false);
  const allowed = applyV9Guardrails({ rights: 'ALLOWED', privacy: 'OK', usageTerms: 'OK' });
  assert.equal(allowed.publishable, true);
  assert.equal(allowed.religiousDecisionAuthority, false);
});

test('full V9 case wires PDF/image/audio evidence through streaming, SNR, anchors and candidate status', async () => {
  const result = await runV9MultimodalLearningCase({
    sourceIdentity: { source_id: 'src:quran:test', work_id: 'work:quran', edition_id: 'edition:hafs', manifestation_id: 'manifestation:test', language: 'ar', rights: 'ALLOWED', provenance: { provider: 'test', chain: ['capture', 'ingest'] }, retrieval_date: '2026-09-17', content_hash: 'sha256:test' },
    media: [{ mediaId: 'pdf:1', modality: 'PDF', contentHash: 'pdf-hash', mimeType: 'application/pdf' }, { mediaId: 'image:1', modality: 'IMAGE', contentHash: 'image-hash', mimeType: 'image/jpeg' }, { mediaId: 'audio:1', modality: 'AUDIO', contentHash: 'audio-hash', mimeType: 'audio/wav', durationMs: 1000 }],
    audioSource: [Buffer.alloc(12)], maxAudioPayloadSize: 8,
    audioBridge: { analyzeSignalQuality: async stream => { for await (const _chunk of stream) {} return { snrDb: 24, accepted: true }; }, processAudioChunk: async chunk => ({ bytes: chunk.length }) },
    anchorMap: [{ audioTimestamp: { startMs: 0, endMs: 500 }, mfaTimestamp: { startMs: 0, endMs: 500 }, canvasCoordinate: { x: 1, y: 2, w: 3, h: 4 }, canonicalWordId: 'quran:1:1:1', iiifCanvasId: 'https://example.test/canvas/1' }],
    alignment: { alignmentId: 'align:1', mediaId: 'audio:1', textId: 'ayah:1:1', segments: [{ text: 'word', startMs: 0, endMs: 500 }], provenance: { sourceId: 'src:quran:test' } },
    recitation: { sessionId: 'session:1', sourceId: 'src:quran:test', surahId: 1, ayahs: [{ ayahId: 1, startMs: 0, endMs: 1000 }] },
    recitationAnalysis: { referenceWords: [{ word: 'a', canonicalWordId: 'quran:1:1:1' }, { word: 'b' }], observedWords: [{ word: 'a', canonicalWordId: 'quran:1:1:1' }, { word: 'x' }], hesitationCount: 1, tajweedCandidates: [{ rule: 'candidate', confidence: 0.6, canonicalWordId: 'quran:1:1:1' }] },
    memorization: { learnerId: 'learner:1', unitId: '1:1', accuracy: 0.9, retention: 0.8 }, spacedReview: { quality: 0.9 },
    terminology: { conceptId: 'tajweed:ghunnah', sourceLanguage: 'ar', targetLanguage: 'en', sourceTerm: 'غنة', targetTerm: 'ghunnah', relation: 'EXACT_EQUIVALENT', provenance: { sourceId: 'src:quran:test' } }, feedback: { errors: [{ type: 'TAJWEED_CANDIDATE' }] }
  });
  assert.equal(result.guardrails.publishable, true);
  assert.equal(result.media.length, 3);
  assert.equal(result.fused.mediaIds.length, 3);
  assert.equal(result.audioPreflight.snrDb, 24);
  assert.equal(result.audioStreamReport.totalBytes, 12);
  assert.equal(result.alignment.segments.length, 1);
  assert.equal(result.recordedAssessment.authoritativeFatwa, false);
  assert.equal(result.recordedAssessment.status, 'AI_SYNTHESIS_CANDIDATE');
  assert.equal(result.recordedAssessment.target, 'LEARNER_SANDBOX');
  assert.equal(result.recordedAssessment.errors[0].canonicalWordId, 'quran:1:1:1');
  assert.equal(result.memorization.learnerId, 'learner:1');
  assert.ok(result.spacedReview.nextReviewAt);
  assert.equal(result.feedback.canIssueFatwa, false);
  assert.equal(result.canonicalQuranArabicMutated, false);
  assert.equal(result.originalPdfMutated, false);
});

test('human feedback is append-only and can only enter governed active learning', () => {
  const event = createV9FeedbackEvent({ feedbackId: 'fb:1', reviewerId: 'reviewer:1', reviewerRole: 'SCHOLAR_REVIEWER', decision: 'TAJWEED_CORRECTION', correction: { from: 'candidate', to: 'review-required' }, evidenceRefs: ['align:1', 'audio:1'], modelVersion: 'v9-model-1' });
  const batch = buildV9ActiveLearningBatch([event]);
  const impact = evaluateV9FeedbackImpact(batch, { precision: 0.92 });
  assert.equal(event.appendOnly, true); assert.equal(batch.candidateOnly, true); assert.equal(impact.deploymentAllowed, false); assert.equal(impact.requiresHumanApproval, true);
});
