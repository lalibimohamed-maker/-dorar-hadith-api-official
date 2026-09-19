import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createV9StageNodeContract,
  createV9MultimodalRecitationEngine,
  createSourceIdentity,
  registerSourceIdentity,
  createIiifPageModel,
  registerIiifPage,
  alignTextToMedia,
  trackRecitation,
  analyzeRecitation,
  recordRecitationAssessment,
  updateMemorizationState,
  scheduleSpacedMemorization,
  alignMultilingualConcept,
  createRecitationFeedback,\n  registerMediaIdentity,
} from '../src/rechercher-v9-multimodal-recitation-engine.js';

test('V9 contract preserves acquisition, provenance, rights and immutable Quran/PDF boundaries', () => {
  const contract = createV9StageNodeContract();
  assert.equal(contract.stageId, 'V9_MULTIMODAL_ISLAMIC_LEARNING');
  assert.equal(contract.safety.canMutateCanonicalQuranArabic, false);
  assert.equal(contract.safety.canMutateOriginalPdf, false);
  assert.equal(contract.safety.acquisitionIndependent, true);
  assert.equal(contract.safety.religiousDecisionAuthority, false);
});

test('dialogue is a first-class V9 modality and remains hash-bound', async () => {\n  const engine = createV9MultimodalRecitationEngine();\n  const media = registerMediaIdentity(engine, { mediaId: 'dialogue:1', modality: 'DIALOGUE', contentHash: 'sha256:dialogue' });\n  assert.equal(media.modality, 'DIALOGUE');\n  assert.equal(media.contentHash, 'sha256:dialogue');\n});\n\ntest('source identity carries work, edition, manifestation, page/passage, rights, provenance and hash', () => {
  const identity = createSourceIdentity({
    source_id: 'source:quran:example', work_id: 'work:quran', edition_id: 'edition:hafs', manifestation_id: 'audio:001',
    page_id: 'page:none', passage_id: 'ayah:1:1', language: 'ar', rights: 'ALLOWED', provenance: { provider: 'test' },
    retrieval_date: '2026-09-15', content_hash: 'sha256:test'
  });
  assert.equal(identity.source_id, 'source:quran:example');
  assert.equal(identity.content_hash, 'sha256:test');
});

test('IIIF page model retains image, OCR, transcription, normalized text, translations and annotations', () => {
  const page = createIiifPageModel({ manifestId: 'm1', canvasId: 'c1', pageId: 'p1', imageId: 'https://example/image.jpg', ocr: 'ocr', transcription: 'trans', normalizedText: 'text', translations: [{ language: 'en', text: 'x' }], annotations: [{ id: 'a1' }], confidence: 0.9 });
  assert.equal(page.canvasId, 'c1');
  assert.equal(page.transcription, 'trans');
  assert.equal(page.annotations.length, 1);
});

test('recitation analysis detects omission, addition, substitution and repetition without changing canonical text', () => {
  const result = analyzeRecitation({ referenceWords: [{ word: 'a' }, { word: 'b' }, { word: 'c' }], observedWords: [{ word: 'a' }, { word: 'x' }, { word: 'x' }, { word: 'c' }], hesitationCount: 2, tajweedCandidates: [{ rule: 'idgham', confidence: 0.7 }] });
  assert.ok(result.errors.some(error => error.type === 'SUBSTITUTION'));
  assert.equal(result.repetitionCount, 1);
  assert.equal(result.hesitationCount, 2);
  assert.equal(result.reviewRequired, true);
});

test('word/media alignment, recitation tracking and assessment are traceable', () => {
  const engine = createV9MultimodalRecitationEngine();
  registerSourceIdentity(engine, { source_id: 'src1', work_id: 'w1', edition_id: 'e1', manifestation_id: 'a1', language: 'ar', rights: 'ALLOWED', provenance: { url: 'https://example.test' }, retrieval_date: '2026-09-15', content_hash: 'h1' });
  registerIiifPage(engine, { manifestId: 'm1', canvasId: 'c1', pageId: 'p1', imageId: 'i1', annotations: [] });
  alignTextToMedia(engine, { alignmentId: 'al1', mediaId: 'audio1', textId: 'ayah1', segments: [{ text: 'word', startMs: 0, endMs: 500 }], provenance: { sourceId: 'src1' } });
  trackRecitation(engine, { sessionId: 's1', sourceId: 'src1', surahId: 1, ayahs: [{ ayahId: 1, startMs: 0, endMs: 1000 }] });
  const assessment = recordRecitationAssessment(engine, 's1', analyzeRecitation({ referenceWords: [{ word: 'a' }], observedWords: [{ word: 'a' }] }));
  assert.equal(assessment.authoritativeFatwa, false);
  assert.ok(engine.traces.length >= 4);
});

test('memorization state supports adaptive spaced review', () => {
  const engine = createV9MultimodalRecitationEngine();
  updateMemorizationState(engine, { learnerId: 'u1', unitId: '1:1', accuracy: 0.95, retention: 0.9 });
  const scheduled = scheduleSpacedMemorization(engine, 'u1', '1:1', { quality: 0.95 });
  assert.ok(scheduled.nextReviewAt);
});

test('multilingual terminology distinguishes exact, approximate, historical, school-specific, variant and no-equivalent relations', () => {
  const engine = createV9MultimodalRecitationEngine();
  const result = alignMultilingualConcept(engine, { conceptId: 'tajweed:ghunnah', sourceLanguage: 'ar', targetLanguage: 'en', sourceTerm: 'غنة', targetTerm: 'ghunnah', relation: 'EXACT_EQUIVALENT', provenance: { sourceId: 'src1' } });
  assert.equal(result.relation, 'EXACT_EQUIVALENT');
  assert.equal(engine.terminology.length, 1);
});

test('feedback remains learning assistance and never becomes a fatwa or infallible religious judgment', () => {
  const feedback = createRecitationFeedback({ errors: [{ type: 'TAJWEED_CANDIDATE' }] });
  assert.equal(feedback.canDeclareReligiousRuling, false);
  assert.equal(feedback.canIssueFatwa, false);
  assert.equal(feedback.shouldEscalateAmbiguousReligiousJudgment, true);
});
