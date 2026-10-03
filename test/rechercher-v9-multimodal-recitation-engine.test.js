import test from 'node:test';
import { strict as assert } from 'node:assert';
import {
  V9_VERSION,
  createMediaAsset,
  createAlignment,
  createRecitationRecord,
  proposeRecitationFinding,
  reviewRecitationFinding,
  verifyRecitationRecord,
  createV9MultimodalRecitationEngine,
} from '../src/rechercher-v9-multimodal-recitation-engine.js';

test('V9 preserves source identity and immutable media provenance', () => {
  const asset = createMediaAsset({
    assetId: 'audio-1',
    sourceId: 'quran-source',
    mediaType: 'AUDIO',
    contentHash: 'sha256:abc',
    locator: 'recording-1',
    rightsStatus: 'ALLOWED',
    provenance: { recorder: 'test' },
  });
  assert.equal(asset.sourceId, 'quran-source');
  assert.equal(asset.immutable, true);
  assert.equal(asset.contentHash, 'sha256:abc');
});

test('V9 aligns audio to a canonical target without modifying the target text', () => {
  const alignment = createAlignment({
    alignmentId: 'a1', assetId: 'audio-1', sourceId: 'quran-source', targetId: 'ayah:1:1',
    startMs: 0, endMs: 1200, textRange: { start: 0, end: 7 }, confidence: 0.94,
  });
  assert.equal(alignment.state, 'DISCOVERED');
  assert.equal(alignment.targetId, 'ayah:1:1');
});

test('V9 keeps automated recitation findings provisional until human review', () => {
  const finding = proposeRecitationFinding({
    findingId: 'f1', recitationId: 'r1', sourceId: 'quran-source',
    type: 'OMISSION_CANDIDATE', locator: { startMs: 200 }, confidence: 0.91,
    evidence: ['audio-alignment'],
  });
  assert.equal(finding.state, 'CANDIDATE_ERROR');
  assert.equal(finding.humanVerified, false);

  const reviewed = reviewRecitationFinding(finding, { reviewerId: 'teacher-1', decision: 'VERIFIED' });
  assert.equal(reviewed.state, 'HUMAN_REVIEWED');
  assert.equal(reviewed.humanVerified, true);
});

test('V9 cannot mark a recitation verified while findings remain unreviewed', () => {
  const record = createRecitationRecord({
    recitationId: 'r1', learnerId: 'learner-1', sourceId: 'quran-source',
    ayahId: 'ayah:1:1', audioAssetId: 'audio-1',
  });
  const finding = proposeRecitationFinding({ findingId: 'f1', recitationId: 'r1', sourceId: 'quran-source' });
  const withFinding = { ...record, findings: [finding] };
  assert.equal(verifyRecitationRecord(withFinding).state, 'CANDIDATE_ERROR');
  assert.equal(verifyRecitationRecord(withFinding, { reviewedFindingIds: ['f1'] }).state, 'VERIFIED');
});

test('V9 engine keeps acquisition and canonical source boundaries independent', () => {
  const engine = createV9MultimodalRecitationEngine();
  assert.equal(V9_VERSION, '9.0.0');
  assert.equal(engine.policy.acquisitionIndependent, true);
  assert.equal(engine.policy.canonicalQuranArabicImmutable, true);
  assert.equal(engine.policy.originalPdfImmutable, true);
  assert.equal(engine.policy.rightsBypass, false);
});
