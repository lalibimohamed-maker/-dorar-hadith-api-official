import test from 'node:test';
import assert from 'node:assert/strict';
import { assessSecuritySignal, createRecoveryPlan, validatePeer } from '../src/security/federated-guardian.js';

const repo = 'lalibimohamed-maker/-dorar-hadith-api-official';

test('accepts the two owner-controlled identities as complementary peers', () => {
  assert.equal(validatePeer({ account: 'lalibimohamed-maker', repository: repo, role: 'evidence-replica' }).valid, true);
  assert.equal(validatePeer({ account: 'lalibimohamed82-coder', repository: repo, role: 'recovery-source' }).valid, true);
});

test('rejects peer write access and independent security destruction', () => {
  assert.equal(validatePeer({ account: 'lalibimohamed82-coder', repository: repo, role: 'recovery-source', writeAccess: true }).valid, false);
  assert.equal(validatePeer({ account: 'lalibimohamed82-coder', repository: repo, role: 'recovery-source', canChangeSecurityPolicy: true }).valid, false);
  assert.equal(validatePeer({ account: 'lalibimohamed82-coder', repository: repo, role: 'recovery-source', canDeleteRecoveryData: true }).valid, false);
});

test('rejects identities outside the approved owner-controlled pair', () => {
  assert.equal(validatePeer({ account: 'unknown-user', repository: repo, role: 'recovery-source' }).valid, false);
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
    peer: { account: 'lalibimohamed82-coder', repository: repo, role: 'recovery-source' },
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
    peer: { account: 'lalibimohamed82-coder', repository: repo, role: 'recovery-source' },
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
  assert.equal(result.mutualMonitoring, true);
  assert.equal(result.independentRecoveryEvidence, true);
  assert.ok(result.actions.includes('human-approval-before-publish'));
});
