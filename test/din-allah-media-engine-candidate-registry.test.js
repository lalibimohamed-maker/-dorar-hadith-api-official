import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const registry = JSON.parse(fs.readFileSync('config/din-allah-media-engine-candidate-registry-2026.json', 'utf8'));

test('candidate registry keeps every model non-binding until exact rights review', () => {
  assert.equal(registry.policy.noAutomaticAdoption, true);
  assert.equal(registry.policy.exactCheckpointRequired, true);
  assert.equal(registry.policy.licenseSnapshotRequired, true);
  assert.equal(registry.policy.territoryCheckRequired, true);
  assert.equal(registry.policy.commercialTermsCheckRequired, true);
  assert.ok(registry.candidates.length >= 8);
  for (const candidate of registry.candidates) {
    assert.ok(candidate.source.startsWith('https://'));
    assert.equal(candidate.status.includes('adopted'), false);
    assert.ok(candidate.licenseStatus);
  }
});

test('audio-video benchmark is only activated when audio generation is in scope', () => {
  assert.equal(registry.evaluationBenchmarks.primary, 'VBench-2.0');
  assert.ok(registry.evaluationBenchmarks.secondary.includes('VBench'));
  assert.ok(registry.evaluationBenchmarks.secondary.includes('AVGen-Bench'));
  assert.equal(registry.evaluationBenchmarks.useAudioVideoBenchmarkWhenAudioIsGenerated, true);
});

test('territory-gated candidates are visibly marked', () => {
  const minimax = registry.candidates.find((candidate) => candidate.id === 'minimax-h3');
  assert.ok(minimax);
  assert.equal(minimax.status, 'territory_and_revenue_gated_candidate');

  const hunyuan = registry.candidates.find((candidate) => candidate.id === 'hunyuanvideo-1.5');
  assert.ok(hunyuan);
  assert.equal(hunyuan.status, 'rights_gated_candidate');
});
