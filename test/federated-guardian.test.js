import test from 'node:test';
import assert from 'node:assert/strict';
import { assessSecuritySignal, createRecoveryPlan, validatePeer } from '../src/security/federated-guardian.js';

test('rejects peer write access by default', () => {
  assert.equal(validatePeer({ repository: 'owner/peer', role: 'recovery-source', writeAccess: true }).valid, false);
});

test('single engine detection stays in observation', () => {
  const result = assessSecuritySignal({
    engines: ['clamav', 'yara', 'trivy'],
    results: { clamav: 'fail', yara: 'pass', trivy: 'pass' },
  });
  assert.equal(result.mode, 'observe');
});

test('correlated detections quarantine and require a checkpoint', () => {
  const result = createRecoveryPlan({
    peer: { repository: 'owner/peer', role: 'recovery-source' },
    signal: {
      engines: ['clamav', 'yara', 'trivy'],
      results: { clamav: 'fail', yara: 'fail', trivy: 'pass' },
    },
    checkpointAvailable: false,
  });
  assert.equal(result.allowed, false);
});

test('verified checkpoint permits isolated restore, never direct destructive automation', () => {
  const result = createRecoveryPlan({
    peer: { repository: 'owner/peer', role: 'recovery-source' },
    signal: {
      engines: ['clamav', 'yara'],
      results: { clamav: 'fail', yara: 'fail' },
      integrityCompromised: true,
    },
    checkpointAvailable: true,
  });
  assert.equal(result.allowed, true);
  assert.equal(result.mode, 'quarantine');
  assert.equal(result.destructiveAutomation, false);
  assert.ok(result.actions.includes('human-approval-before-publish'));
});
