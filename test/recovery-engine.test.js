import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRecoveryPlan, findCreationCommit } from '../scripts/recovery-engine.mjs';

// Unit tests use HEAD as a self-contained source fixture. The production
// recovery workflow explicitly fetches protected main before invoking the
// engine, so the engine's default remains origin/main and never falls back
// implicitly to the PR branch.
const TEST_SOURCE_REF = 'HEAD';

test('recovery only plans allowlisted workflow files', () => {
  const plan = buildRecoveryPlan({
    sourceRef: TEST_SOURCE_REF,
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
  const plan = buildRecoveryPlan({
    sourceRef: TEST_SOURCE_REF,
    files: ['.github/workflows/ci.yml']
  });
  assert.equal(plan[0].protectedMainDirectWrite, false);
});
