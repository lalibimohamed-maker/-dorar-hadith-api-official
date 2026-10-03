import test from 'node:test';
import assert from 'node:assert/strict';
import { STATES, canTransition, transitionRuntime, redactDiagnostics, normalizeProgress } from '../src/voice-platform-contract.js';

test('voice platform lifecycle is explicit and fail-closed', () => {
  assert.equal(STATES.length, 9);
  assert.equal(canTransition('declared', 'acquiring'), true);
  assert.equal(canTransition('declared', 'ready'), false);
  assert.throws(() => transitionRuntime('acquired', 'checksum-verified', {sha256Verified:false}), /checksum evidence required/);
  assert.equal(transitionRuntime('acquired', 'checksum-verified', {sha256Verified:true}), 'checksum-verified');
  assert.throws(() => transitionRuntime('loaded', 'inference-verified', {realInference:false}), /real inference evidence required/);
  assert.equal(transitionRuntime('inference-verified', 'ready', {sha256Verified:true, licenseReviewed:true, realInference:true}), 'ready');
});

test('diagnostics redact secrets and progress events normalize safely', () => {
  const safe = redactDiagnostics({token:'secret-value', api_key:'secret-key', nested:{authorization:'Bearer secret', ok:true}});
  assert.equal(safe.token, '[REDACTED]');
  assert.equal(safe.api_key, '[REDACTED]');
  assert.equal(safe.nested.authorization, '[REDACTED]');
  assert.equal(safe.nested.ok, true);
  assert.deepEqual(normalizeProgress({sequence:4, phase:'asr-partial', completed:false}), {sequence:4, phase:'asr-partial', completed:false});
});
