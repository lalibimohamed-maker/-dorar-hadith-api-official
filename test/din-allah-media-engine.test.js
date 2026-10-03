import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizeExport,
  bindQuranText,
  bindVerifiedRecitation,
  createBrief,
  createEvidencePacket,
  createStoryboard,
  evaluateQuality,
  evaluateSync,
  evaluateVisualSource,
  mediaEngineCapability,
  validateMediaMaster
} from '../src/din-allah-media-engine.js';

const provenance = { sourceId: 'source-1', citation: 'book:p1', verifiedAt: '2026-09-28T00:00:00Z' };
const rights = { status: 'licensed', cleared: true };

function packet() {
  return createEvidencePacket({
    sources: [{ id: 'source-1', url: 'https://example.invalid/source', provenance }],
    claims: [{ id: 'claim-1', evidenceIds: ['source-1'], uncertainty: 'explicit' }]
  });
}

test('pipeline stays separate from corpus and acquisition', () => {
  const caps = mediaEngineCapability();
  assert.equal(caps.modelGenerationInCi, false);
  assert.equal(caps.heavyVideoDownloadsInCi, false);
  assert.equal(caps.generatedMediaInGit, false);
  assert.equal(caps.corpusMutation, false);
  assert.equal(caps.acquisitionBlocking, false);
});

test('evidence packets require source-backed claims', () => {
  const value = packet();
  assert.equal(value.uncertaintyExplicit, true);
  assert.throws(() => createEvidencePacket({
    sources: [{ id: 's', reference: 'ref', provenance }],
    claims: [{ id: 'claim', evidenceIds: [] }]
  }), /explicit evidence ids/);
});

test('storyboard keeps generated scenes distinct from evidence', () => {
  const board = createStoryboard({
    evidencePacket: packet(),
    scenes: [{ id: 'scene-1', claimIds: ['claim-1'], generatedScene: true }]
  });
  assert.equal(board.scenes[0].generatedScene, true);
});

test('visual source requires provenance and rights for imported media', () => {
  assert.equal(evaluateVisualSource({
    kind: 'imported',
    provenance,
    rights,
    generated: false
  }).allowed, true);
  assert.equal(evaluateVisualSource({
    kind: 'imported',
    provenance,
    rights: { status: 'rights-unclear' },
    generated: false
  }).allowed, false);
});

test('Quran text is canonical and cannot be generated', () => {
  const value = bindQuranText({
    text: 'الحمد لله رب العالمين',
    sourceId: 'quran-canonical',
    citation: '1:2',
    rights
  });
  assert.equal(value.canonical, true);
  assert.equal(value.generated, false);
  assert.throws(() => bindQuranText({
    text: 'generated',
    sourceId: 'quran-canonical',
    citation: '1:2',
    rights,
    generated: true
  }), /cannot be generated/);
});

test('recitation stays Arabic and independently rights-cleared', () => {
  const value = bindVerifiedRecitation({
    assetId: 'rec-1',
    sourceUrl: 'https://example.invalid/recitation',
    provenance,
    rights,
    language: 'ar'
  });
  assert.equal(value.verified, true);
  assert.equal(value.generated, false);
  assert.throws(() => bindVerifiedRecitation({
    assetId: 'rec-2',
    sourceUrl: 'https://example.invalid/recitation',
    provenance,
    rights,
    language: 'en'
  }), /must remain Arabic/);
});

test('sync requires verified Quran, recitation and audio integrity', () => {
  const quranText = bindQuranText({ text: 'الحمد لله رب العالمين', sourceId: 'q', citation: '1:2', rights });
  const recitation = bindVerifiedRecitation({
    assetId: 'r', sourceUrl: 'https://example.invalid/r', provenance, rights, language: 'ar'
  });
  assert.equal(evaluateSync({
    quranText,
    recitation,
    timings: [{ start: 0, end: 1 }],
    audioStreamIntegrity: true
  }).allowed, true);
});

test('quality contract uses VBench-2.0 as primary benchmark without CI model downloads', () => {
  const value = evaluateQuality({
    benchmark: { 'VBench-2.0': { reported: true }, VBench: { reported: true } },
    customGates: {
      quranTextIntegrity: true,
      recitationIntegrity: true,
      provenance: true,
      rights: true,
      unintendedGeneratedText: true,
      temporalConsistency: true,
      audioStreamIntegrity: true
    }
  });
  assert.equal(value.allowed, true);
  assert.equal(value.benchmarkPolicy.primary, 'VBench-2.0');
});

test('master requires human review before export', () => {
  const quranText = bindQuranText({ text: 'الحمد لله رب العالمين', sourceId: 'q', citation: '1:2', rights });
  const recitation = bindVerifiedRecitation({
    assetId: 'r', sourceUrl: 'https://example.invalid/r', provenance, rights, language: 'ar'
  });
  const visualSource = evaluateVisualSource({ kind: 'self-hosted-generation', provenance, generated: true });
  const quality = evaluateQuality({
    benchmark: { 'VBench-2.0': { reported: true } },
    customGates: Object.fromEntries([
      'quranTextIntegrity','recitationIntegrity','provenance','rights','unintendedGeneratedText','temporalConsistency','audioStreamIntegrity'
    ].map((key) => [key, true]))
  });
  const sync = evaluateSync({ quranText, recitation, timings: [{ start: 0, end: 1 }], audioStreamIntegrity: true });
  const master = validateMediaMaster({
    brief: createBrief({ id: 'b', title: 't', objective: 'o' }),
    storyboard: createStoryboard({ evidencePacket: packet(), scenes: [{ id: 's', claimIds: ['claim-1'] }] }),
    visualSource,
    quality,
    quranText,
    recitation,
    sync,
    humanReview: true
  });
  assert.equal(master.state, 'validated-master');
  assert.equal(authorizeExport({ master, format: 'mp4' }).allowed, true);
  assert.equal(authorizeExport({ master, format: 'mp4', recitationRights: false }).allowed, false);
});
