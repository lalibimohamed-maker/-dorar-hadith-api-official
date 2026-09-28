const rightsRecord = {
  resourceId: 'book:123',
  status: 'licensed',
  basis: 'explicit-license',
  source: 'https://example.invalid/rights',
  verifiedAt: '2026-09-28',
  verifier: 'governance-test'
};
import test from 'node:test';
import assert from 'node:assert/strict';
import { createExecutionPlan, evaluateOperation, listGovernanceNetworks } from '../src/algorithmic-governance-mesh.js';

test('exposes independent governance networks', () => {
  const networks = listGovernanceNetworks();
  for (const name of ['processing', 'safety', 'protection', 'defense', 'provenance', 'recovery']) {
    assert.ok(Array.isArray(networks[name]));
  }
});

test('allows a non-destructive verified operation and creates an audit plan', () => {
  const plan = createExecutionPlan({
    action: 'transform',
    target: 'book:123',
    requiresRights: true,
    requiresIntegrity: true,
    rightsRecord,
    evidence: { integrityVerified: true },
    rollbackAvailable: true
  });
  assert.equal(plan.allowed, true);
  assert.equal(plan.auditRequired, true);
  assert.equal(plan.provenanceRequired, true);
  assert.ok(plan.stages.includes('integrity-check'));
});

test('blocks destructive work without recovery', () => {
  const decision = evaluateOperation({ action: 'delete', destructive: true, rollbackAvailable: false });
  assert.equal(decision.allowed, false);
});

test('blocks redistribution without a complete rights ledger record', () => {
  const decision = evaluateOperation({ action: 'publish', requiresRights: true, evidence: {} });
  assert.equal(decision.allowed, false);
});

test('accepts redistribution only with a complete allowed rights record', () => {
  const decision = evaluateOperation({ action: 'publish', requiresRights: true, rightsRecord });
  assert.equal(decision.allowed, true);
});

test('status-only rights claims do not satisfy the governance mesh', () => {
  const decision = evaluateOperation({
    action: 'publish',
    requiresRights: true,
    rightsRecord: { status: 'licensed' }
  });
  assert.equal(decision.allowed, false);
});

test('blocks invalid integrity claims', () => {
  const decision = evaluateOperation({ action: 'write', requiresIntegrity: true, evidence: { integrityVerified: false } });
  assert.equal(decision.allowed, false);
});
