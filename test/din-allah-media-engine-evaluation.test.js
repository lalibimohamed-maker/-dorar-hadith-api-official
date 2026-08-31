import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('config/din-allah-media-engine-2026.json', 'utf8'));

test('Din Allah Media Engine benchmark has self-hosted candidates and VBench baseline', () => {
  assert.equal(manifest.status, 'evaluation_benchmark');
  assert.equal(manifest.principles.selfHostedFirst, true);
  assert.ok(manifest.candidateBackends.length >= 4);
  assert.equal(manifest.evaluationSuite.benchmark, 'VBench');
  assert.ok(manifest.promptSuite.length >= 4);
});

test('Quran is isolated from video generation', () => {
  assert.equal(manifest.principles.quranTextIsImmutable, true);
  assert.equal(manifest.principles.quranRecitationIsSeparateAsset, true);
  assert.ok(manifest.failurePolicy.modelAddsQuranicText.includes('reject'));
});

test('rights and provenance are hard publication gates', () => {
  assert.equal(manifest.principles.rightsAreAssetSpecific, true);
  assert.equal(manifest.principles.provenanceRequired, true);
  assert.equal(manifest.failurePolicy.missingProvenance, 'block_publication');
  assert.equal(manifest.failurePolicy.unknownCommercialRights, 'block_publication');
});

test('audio integrity is an explicit acceptance dimension', () => {
  assert.equal(manifest.failurePolicy.missingRequiredAudio, 'block_export');
  assert.ok(manifest.evaluationSuite.additionalDinAllahChecks.includes('audio_stream_integrity'));
});
