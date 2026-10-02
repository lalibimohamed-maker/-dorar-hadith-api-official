import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getPlatformVoiceAdapter } from '../src/platform-voice-adapters.js';

const cfg = JSON.parse(fs.readFileSync('config/platform-voice-engine-bundles-2026.json', 'utf8'));

test('every platform adapter has an engine bundle', () => {
  for (const adapter of getPlatformVoiceAdapterIds()) {
    assert.ok(cfg.platforms[adapter], 'missing engine bundle: ' + adapter);
  }
});

function getPlatformVoiceAdapterIds() {
  return ['ios','android','harmonyOS','web','androidTV','wearOS','harmonyTV','harmonyWearable','automotive','smartHome'];
}

test('Al-Huda engine bundle preserves a shared reasoning core', () => {
  assert.deepEqual(cfg.sharedCore.reasoning, ['Al-Huda', 'Al-Taqwa']);
  assert.equal(cfg.policy.sameReasoningCoreAcrossPlatforms, true);
  assert.equal(cfg.policy.noCorpusModification, true);
});

test('low-power surfaces select the lightweight ASR target', () => {
  assert.equal(cfg.platforms.wearOS.input, 'qwen3-asr-0.6b');
  assert.equal(cfg.platforms.harmonyWearable.input, 'qwen3-asr-0.6b');
  assert.equal(cfg.platforms.automotive.input, 'qwen3-asr-0.6b');
  assert.equal(cfg.platforms.smartHome.input, 'qwen3-asr-0.6b');
});
