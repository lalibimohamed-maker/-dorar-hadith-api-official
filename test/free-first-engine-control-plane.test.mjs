import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const registry = JSON.parse(fs.readFileSync('config/global/free-first-engine-control-plane-2026.json', 'utf8'));

test('free-first control plane has no paid core dependency', () => {
  assert.equal(registry.policy.freeFirst, true);
  assert.equal(registry.policy.paidApiRequired, false);
  assert.equal(registry.policy.subscriptionRequired, false);
});

test('all registered engines require evidence before enablement', () => {
  for (const requirement of ['officialSource', 'codeLicense', 'securityReview', 'runtimeProof', 'benchmarkProof', 'provenanceProof']) {
    assert.ok(registry.evidenceRequired.includes(requirement), requirement);
  }
  assert.deepEqual(registry.states.slice(0, 2), ['DISCOVERED', 'LICENSE_REVIEW']);
});

test('resolution remains open ended and native claims are measured', () => {
  assert.equal(registry.resolution.applicationCeiling, null);
  assert.ok(registry.resolution.targets.includes('24K'));
  assert.ok(registry.resolution.targets.includes('future'));
  assert.equal(registry.resolution.nativeClaimRequiresMeasurement, true);
  assert.equal(registry.resolution.derivedOutputMustBeLabeledDerived, true);
});

test('core domains include OCR, speech, search, security, media and display', () => {
  for (const domain of ['ocr', 'speech', 'search', 'security', 'media', 'display']) {
    assert.ok(Array.isArray(registry.domains[domain].candidates));
    assert.ok(registry.domains[domain].candidates.length > 0, domain);
  }
});
