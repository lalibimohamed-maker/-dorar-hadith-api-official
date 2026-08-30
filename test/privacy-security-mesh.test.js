import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSensorAccess, evaluateBluetoothSession, checkSpamRate, approveExecutable } from '../src/security/privacy-security-mesh.mjs';

test('camera and microphone require explicit granted permission and active session', () => {
  assert.deepEqual(evaluateSensorAccess({ sensor:'camera', permission:'denied', activeSession:true }), { allowed:false, reason:'explicit-permission-required' });
  assert.deepEqual(evaluateSensorAccess({ sensor:'microphone', permission:'granted', activeSession:false }), { allowed:false, reason:'no-active-user-session' });
  assert.equal(evaluateSensorAccess({ sensor:'camera', permission:'granted', activeSession:true }).allowed, true);
});

test('Bluetooth sessions require explicit approval and reject unexpected devices', () => {
  assert.deepEqual(evaluateBluetoothSession({ paired:true, explicitApproval:false }), { allowed:false, reason:'explicit-pairing-approval-required' });
  assert.deepEqual(evaluateBluetoothSession({ paired:true, explicitApproval:true, unexpectedDevice:true }), { allowed:false, reason:'unexpected-device-change' });
  assert.equal(evaluateBluetoothSession({ paired:true, explicitApproval:true }).allowed, true);
});

test('spam limiter blocks bursts after the configured threshold', () => {
  const now = 100000;
  const events = Array.from({ length: 30 }, (_, i) => now - i * 1000);
  assert.equal(checkSpamRate({ events, nowMs:now }).allowed, false);
  assert.equal(checkSpamRate({ events:events.slice(1), nowMs:now }).allowed, true);
});

test('executables are not approved when security evidence is unknown or failed', () => {
  assert.equal(approveExecutable({ malwareScan:'unknown', dependencyAudit:'success', staticAnalysis:'success' }), false);
  assert.equal(approveExecutable({ malwareScan:'success', dependencyAudit:'success', staticAnalysis:'success' }), true);
});
