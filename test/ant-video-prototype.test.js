import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('config/video-prototypes/ant-communication-27-18-2026.json', 'utf8'));

test('ant prototype has evidence-first structure', () => {
  assert.equal(manifest.status, 'prototype_benchmark_only');
  assert.equal(manifest.evidence.length, 3);
  assert.ok(manifest.evidence.some((x) => x.type === 'quran_text'));
  assert.ok(manifest.evidence.some((x) => x.type === 'scientific_observation'));
  assert.ok(manifest.scenes.length >= 5);
});

test('prototype blocks uncleared third-party media and Quranic recitation', () => {
  assert.equal(manifest.rights.thirdPartyMedia, 'research_leads_only_until_asset_clearance');
  assert.equal(manifest.rights.recitation, 'not_embedded_until_rights_cleared');
  assert.equal(manifest.rights.generatedVisuals, 'original_vector_animatic');
});

test('prototype preserves a 48K-ready production handoff', () => {
  assert.equal(manifest.output.masterTarget, 'inherits 48K-class mastering pipeline later');
  assert.equal(manifest.output.audio, 'rights-cleared narration/recitation required for production master');
});
