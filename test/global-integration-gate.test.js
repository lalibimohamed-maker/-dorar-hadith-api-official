import test from 'node:test';
import assert from 'node:assert/strict';
import { auditGlobalResearchSystem } from '../src/research/global-integration-gate.js';

test('global research system enforces cross-system safeguards', () => {
  const result = auditGlobalResearchSystem();
  assert.equal(result.ok, true);
  assert.equal(result.checks.freeFirst, true);
  assert.equal(result.checks.noPaidDependency, true);
  assert.equal(result.checks.remoteContentUntrusted, true);
  assert.equal(result.checks.toolInvocationBlockedFromSourceText, true);
  assert.equal(result.checks.provenanceRequired, true);
  assert.equal(result.checks.independenceClustering, true);
  assert.equal(result.checks.noInventedDetails, true);
  assert.equal(result.checks.toolIsNotAuthority, true);
});
