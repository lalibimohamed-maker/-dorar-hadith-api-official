import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getPlatformVoiceAdapter, listPlatformVoiceAdapters } from '../src/platform-voice-adapters.js';

const matrixPath = path.resolve('config/platform-assistant-integration-2026.json');
const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));

test('Al-Huda platform matrix covers native and device-family integrations', () => {
  const required = ['ios','android','harmonyOS','web','androidTV','wearOS','harmonyTV','harmonyWearable','automotive','smartHome'];
  for (const id of required) {
    assert.ok(matrix.platforms[id], 'missing matrix entry: ' + id);
    const adapter = getPlatformVoiceAdapter(id);
    assert.equal(adapter.id, id);
  }
});

test('Android-derived TV and wearable profiles reuse the selected assistant family', () => {
  assert.equal(getPlatformVoiceAdapter('androidTV').parent, 'android');
  assert.equal(getPlatformVoiceAdapter('wearOS').parent, 'android');
});

test('Harmony device profiles reuse the HarmonyOS native adapter', () => {
  assert.equal(getPlatformVoiceAdapter('harmonyTV').parent, 'harmonyOS');
  assert.equal(getPlatformVoiceAdapter('harmonyWearable').parent, 'harmonyOS');
});

test('Al-Huda remains the canonical assistant identity in the matrix', () => {
  assert.equal(matrix.assistant.name, 'Al-Huda');
  assert.equal(matrix.assistant.arabicName, 'الهُدَى');
  assert.equal(matrix.assistant.wakePhrase, 'الهُدَى');
  assert.ok(listPlatformVoiceAdapters().length >= 10);
});
