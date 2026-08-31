import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMediaPlan, loadMediaEngineContract, makeDryRunPlan } from '../src/din-allah-media-engine-contract.js';

test('clean media engine contract is self-hosted and search-independent', () => {
  const c = loadMediaEngineContract();
  assert.equal(c.principles.selfHostedFirst, true);
  assert.equal(c.principles.freeFirst, true);
  assert.equal(c.principles.searchIndependent, true);
  assert.equal(c.principles.noCorpusMutation, true);
  assert.equal(c.principles.noRuntimeDependency, true);
});

test('clean engine keeps Quran text and recitation separate', () => {
  const c = loadMediaEngineContract();
  assert.equal(c.quranPolicy.textHandling, 'verbatim_only');
  assert.equal(c.quranPolicy.generatedQuranText, 'forbidden');
  assert.equal(c.quranPolicy.generatedQuranRecitation, 'forbidden');
  assert.equal(c.quranPolicy.recitation, 'separate_rights_cleared_asset');
});

test('clean engine has explicit quality and rights gates', () => {
  const c = loadMediaEngineContract();
  assert.equal(c.failurePolicy.missingEvidence, 'block_publication');
  assert.equal(c.failurePolicy.missingRights, 'block_publication');
  assert.equal(c.failurePolicy.missingProvenance, 'block_publication');
  assert.equal(c.failurePolicy.invalidQuranText, 'block_export');
  assert.equal(c.failurePolicy.missingRequiredAudio, 'block_export');
});

test('dry-run production plan passes without generating media', () => {
  const result = evaluateMediaPlan(makeDryRunPlan());
  assert.equal(result.ok, true);
  assert.deepEqual(result.failed, []);
});

test('invalid plan fails closed', () => {
  const result = evaluateMediaPlan({
    brief: 'x',
    visualSource: { kind: 'external' },
    quranTextMode: 'generated',
    generatedQuranText: true,
    generatedQuranRecitation: true,
    rightsStatus: 'unknown',
    provenanceStatus: 'missing'
  });
  assert.equal(result.ok, false);
  assert.ok(result.failed.includes('quranTextBoundToVerifiedSource'));
  assert.ok(result.failed.includes('rightsPresent'));
  assert.ok(result.failed.includes('provenancePresent'));
});
