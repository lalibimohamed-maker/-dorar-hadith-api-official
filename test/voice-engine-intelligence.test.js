import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getVoiceEngine, listVoiceEngines, selectVoiceEngine } from '../src/voice-engine-intelligence.js';

const cfg = JSON.parse(fs.readFileSync('config/voice-engine-intelligence-2026.json', 'utf8'));

test('VoiceStudio is a reference, not a runtime or Corpus dependency', () => {
  assert.equal(cfg.reference.repository, 'debpalash/VoiceStudio');
  assert.equal(cfg.reference.notRuntimeDependency, true);
  assert.equal(cfg.reference.notCorpusDependency, true);
});
test('VoiceStudio-derived capabilities preserve Al-Huda boundaries', () => {
  assert.equal(cfg.hardBoundaries.noCorpusModification, true);
  assert.equal(cfg.hardBoundaries.quranRecitationUsesOriginalAudio, true);
  assert.equal(cfg.hardBoundaries.modelLicenseReviewRequired, true);
  assert.equal(cfg.hardBoundaries.neverDownloadImplicitly, true);
});
test('local engine catalogue exposes the core voice stack', () => {
  const ids = listVoiceEngines().map((x) => x.id);
  for (const id of ['qwen3-asr-0.6b','qwen3-asr-1.7b','silero-vad','al-huda-kws']) assert.ok(ids.includes(id), 'missing engine: ' + id);
  assert.equal(getVoiceEngine('qwen3-asr-1.7b').capability, 'asr');
});
test('low-power selection prefers the lightweight ASR engine', () => {
  assert.equal(selectVoiceEngine({ capability: 'asr', lowPower: true }).id, 'qwen3-asr-0.6b');
});
test('unknown engines fail closed', () => {
  assert.throws(() => getVoiceEngine('not-an-al-huda-engine'), /Unknown Al-Huda voice engine/);
});

test('engine catalogue exposes operational states for auxiliary engines', () => {
  const byId = new Map(listVoiceEngines().map(engine => [engine.id, engine]));
  assert.equal(byId.get('qwen3-forced-aligner-0.6b').status, 'runnable-supported-languages-only');
  assert.equal(byId.get('piper-en-us-libritts-high').status, 'runnable-release-verified');
  assert.equal(byId.get('f5-tts-v1-base').status, 'release-present-license-constrained-runtime-pending');
  assert.equal(byId.get('piper-ar-jo-kareem-medium').status, 'quarantine-license-review');
  assert.equal(byId.get('whisper-cpp-ggml-base-multilingual').status, 'runnable-release-verified');
  assert.equal(byId.get('sherpa-onnx-speaker-recognition').status, 'acquired-runtime-evidence-pending');
  assert.equal(byId.get('sherpa-onnx-gtcrn-noise-suppression').status, 'runnable-release-verified');
});
