import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRecoveryPlan, findCreationCommit } from '../scripts/recovery-engine.mjs';

test('recovery only plans allowlisted workflow files', () => {
  const plan = buildRecoveryPlan({
    files: ['.github/workflows/corpus-validation.yml', 'src/encyclopedia-api.js', 'config/source-refresh-baselines.json']
  });
  assert.equal(plan.length, 1);
  assert.equal(plan[0].path, '.github/workflows/corpus-validation.yml');
  assert.equal(plan[0].requiresIndependentReview, true);
});

test('recovery records an immutable creation commit when available', () => {
  const commit = findCreationCommit('.github/workflows/corpus-validation.yml');
  assert.match(commit ?? '', /^[0-9a-f]{40}$/);
});

test('recovery never opts into direct protected-main writes', () => {
  const plan = buildRecoveryPlan({ files: ['.github/workflows/ci.yml'] });
  assert.equal(plan[0].protectedMainDirectWrite, false);
});
