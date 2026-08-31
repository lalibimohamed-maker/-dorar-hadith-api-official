import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const file = path.join(process.cwd(), 'config/video-prototypes/global-multilingual-voice-engine-2026.json');
const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));

test('global voice engine registry exists and is quality gated', () => {
  assert.equal(cfg.status, 'prototype_registry');
  assert.equal(cfg.qualityPolicy.rejectUnintelligibleAudio, true);
  assert.equal(cfg.qualityPolicy.requireNativeLanguageEvaluation, true);
  assert.equal(cfg.qualityPolicy.requireAssetLicenseReview, true);
  assert.equal(cfg.qualityPolicy.humanFallbackWhenNoModelMeetsThreshold, true);
});

test('required engine families are registered', () => {
  const ids = cfg.engines.map((e) => e.id);
  assert.ok(ids.includes('chatterbox-multilingual-v3'));
  assert.ok(ids.includes('qwen3-tts'));
  assert.ok(ids.includes('piper'));
  assert.ok(ids.includes('facebook-mms-tts'));
  assert.ok(ids.includes('seamlessm4t-v2'));
});

test('hard noncommercial gates are explicit', () => {
  for (const id of ['facebook-mms-tts', 'seamlessm4t-v2']) {
    const engine = cfg.engines.find((e) => e.id === id);
    assert.ok(engine);
    assert.match(engine.licenseGate, /noncommercial/i);
  }
});

test('Quranic recitation is separated from narrator TTS', () => {
  assert.equal(cfg.quranPolicy.ttsRecitation, 'forbidden');
  assert.equal(cfg.quranPolicy.recitationRoute, 'licensed_verified_quran_recitation_only');
});

test('provenance fields are complete enough for reproducibility', () => {
  assert.equal(cfg.provenance.storeWithVideo, true);
  const required = new Set(cfg.provenance.requiredFields);
  for (const field of [
    'engine', 'engineVersion', 'modelCheckpoint', 'voiceId', 'voiceLanguage',
    'voiceLicense', 'textHash', 'ssmlHash', 'lexiconVersion', 'generationTimestamp', 'qaResult'
  ]) {
    assert.ok(required.has(field), `missing provenance field: ${field}`);
  }
});
