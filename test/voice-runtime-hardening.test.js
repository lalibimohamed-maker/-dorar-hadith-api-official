import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateVoiceRuntimeEvidence, selectVoiceRuntimeProfile, isCompleteAcquisition } from '../src/voice-runtime-hardening.js';

test('installation alone never proves runtime readiness', () => {
  assert.equal(evaluateVoiceRuntimeEvidence({installed:true}).ready, false);
  assert.equal(evaluateVoiceRuntimeEvidence({installed:true,loadable:true,inferenceVerified:true}).ready, true);
});
test('resource-aware routing selects low-power under pressure', () => {
  assert.equal(selectVoiceRuntimeProfile({memoryMb:1024,thermal:'critical'}), 'low-power');
  assert.equal(selectVoiceRuntimeProfile({memoryMb:4096,thermal:'nominal',preferred:'quality'}), 'quality');
});
test('partial or unchecked downloads never become complete', () => {
  assert.equal(isCompleteAcquisition({bytesExpected:100,bytesReceived:99,checksumVerified:true}), false);
  assert.equal(isCompleteAcquisition({bytesExpected:100,bytesReceived:100,checksumVerified:false}), false);
  assert.equal(isCompleteAcquisition({bytesExpected:100,bytesReceived:100,checksumVerified:true}), true);
});
