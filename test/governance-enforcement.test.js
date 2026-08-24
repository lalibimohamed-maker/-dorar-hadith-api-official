import test from 'node:test';
import assert from 'node:assert/strict';
import { runGovernedOperation } from '../src/governance-enforcement.js';

test('denies an operation rejected by the governance mesh before execution', async () => {
  let executed = false;
  const result = await runGovernedOperation({
    request: { action: 'publish', requiresRights: true, evidence: {} },
    execute: async () => { executed = true; return 'must-not-run'; }
  });
  assert.equal(result.status, 'denied');
  assert.equal(executed, false);
});

test('requires audit and checkpoint for a reversible write', async () => {
  const events = [];
  const result = await runGovernedOperation({
    request: {
      action: 'write',
      target: 'book:123',
      requiresIntegrity: true,
      evidence: { integrityVerified: true },
      rollbackAvailable: true
    },
    execute: async () => 'ok',
    audit: async (event) => events.push(['audit', event.status]),
    checkpoint: async () => events.push(['checkpoint']),
    validateOutput: async (value) => value === 'ok'
  });
  assert.equal(result.status, 'completed');
  assert.ok(events.some(([kind]) => kind === 'checkpoint'));
  assert.ok(events.filter(([kind]) => kind === 'audit').length >= 2);
});

test('quarantines output rejected by a downstream validator', async () => {
  const quarantined = [];
  const result = await runGovernedOperation({
    request: { action: 'transform', target: 'book:123', rollbackAvailable: true },
    execute: async () => ({ text: 'changed' }),
    audit: async () => {},
    checkpoint: async () => {},
    validateOutput: async () => false,
    quarantine: async (event) => quarantined.push(event.status)
  });
  assert.equal(result.status, 'quarantined');
  assert.deepEqual(quarantined, ['output-rejected']);
  assert.equal(result.result, null);
});

test('does not execute destructive work without rollback', async () => {
  let executed = false;
  const result = await runGovernedOperation({
    request: { action: 'delete', destructive: true, rollbackAvailable: false },
    execute: async () => { executed = true; }
  });
  assert.equal(result.status, 'denied');
  assert.equal(executed, false);
});
