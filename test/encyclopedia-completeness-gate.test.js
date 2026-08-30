import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCompletenessArchitecture } from '../src/encyclopedia-completeness-gate.js';

test('completeness architecture is internally consistent', () => {
  const result = validateCompletenessArchitecture();
  assert.equal(result.ok, true);
  assert.equal(result.rules.authoritativeCorpusIsolation, true);
  assert.equal(result.rules.claimLevelCitations, true);
  assert.equal(result.rules.modelNotPrimaryEvidence, true);
  assert.equal(result.rules.redundantEngines, true);
  assert.equal(result.rules.wcag22AA, true);
  assert.equal(result.rules.iiif30, true);
  assert.equal(result.rules.roCrate12, true);
});
