import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVoiceRuntimeContract, normalizeVoiceFailure, canUseRemoteVoiceBackend } from '../src/voice-runtime-contract.js';

test('runtime cannot be verified without self-test, inference, license and checksum evidence', () => {
  assert.equal(validateVoiceRuntimeContract({}).valid, false);
  const report = {modelId:'qwen3-asr-0.6b',modelVersion:'pinned',licenseEvidence:'record',sha256:'abc',backend:'local',deviceProfile:'low-power',selfTest:'passed',inferenceTest:'passed',licenseReviewed:true,checksumVerified:true};
  assert.equal(validateVoiceRuntimeContract(report).status, 'inference-verified');
  assert.equal(validateVoiceRuntimeContract({...report,inferenceTest:'skipped'}).valid, false);
});
test('unknown failures are normalized to a safe known category', () => {
  assert.equal(normalizeVoiceFailure('checksum-mismatch'), 'checksum-mismatch');
  assert.equal(normalizeVoiceFailure('secret-stack-trace'), 'backend-unavailable');
});
test('remote execution requires explicit opt-in and local failure', () => {
  assert.equal(canUseRemoteVoiceBackend({userOptIn:true,policyAllows:true,localUnavailable:true}), true);
  assert.equal(canUseRemoteVoiceBackend({userOptIn:false,policyAllows:true,localUnavailable:true}), false);
  assert.equal(canUseRemoteVoiceBackend({userOptIn:true,policyAllows:true,localUnavailable:false}), false);
});
