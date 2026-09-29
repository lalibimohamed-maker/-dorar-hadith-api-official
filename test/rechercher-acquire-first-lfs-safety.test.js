import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('acquire-first review reconciliation skips legacy LFS smudge', () => {
  const workflow = fs.readFileSync('.github/workflows/rechercher-acquire-first.yml', 'utf8');
  assert.ok(workflow.includes('export GIT_LFS_SKIP_SMUDGE=1'));
  assert.ok(workflow.includes('git fetch origin "$REVIEW_BRANCH"'));
  assert.ok(workflow.includes('git checkout -B "$REVIEW_BRANCH" "origin/$REVIEW_BRANCH"'));
});
