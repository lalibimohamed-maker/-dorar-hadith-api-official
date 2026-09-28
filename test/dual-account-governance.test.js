import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const codeowners = fs.readFileSync(new URL('../.github/CODEOWNERS', import.meta.url), 'utf8');
const policy = fs.readFileSync(new URL('../docs/governance/dual-account-algorithmic-governance-2026.md', import.meta.url), 'utf8');

test('dual-account governance keeps ordinary paths jointly maintained', () => {
  assert.match(codeowners, /^\/src\/ @lalibimohamed-maker @lalibimohamed82-coder$/m);
  assert.match(codeowners, /^\/test\/ @lalibimohamed-maker @lalibimohamed82-coder$/m);
  assert.match(codeowners, /^\/scripts\/ @lalibimohamed-maker @lalibimohamed82-coder$/m);
  assert.match(codeowners, /^\/docs\/ @lalibimohamed-maker @lalibimohamed82-coder$/m);
  assert.match(codeowners, /^\/config\/ @lalibimohamed-maker @lalibimohamed82-coder$/m);
});

test('dual-account governance keeps sensitive controls primary-only', () => {
  assert.match(codeowners, /^\/\.github\/ @lalibimohamed-maker$/m);
  assert.match(codeowners, /^\/scripts\/enforce_all_branch_governance\.py @lalibimohamed-maker$/m);
  assert.match(codeowners, /^\/scripts\/enforce_branch_workflow_policy\.py @lalibimohamed-maker$/m);
  assert.match(codeowners, /^\/scripts\/recovery-engine\.mjs @lalibimohamed-maker$/m);
  assert.match(codeowners, /^\/config\/auto-recovery-policy-2026\.json @lalibimohamed-maker$/m);
  assert.match(codeowners, /^\/SECURITY\.md @lalibimohamed-maker$/m);
  assert.match(codeowners, /^\/package-lock\.json @lalibimohamed-maker$/m);
});

test('dual-account governance keeps a single effective CODEOWNERS location', () => {
  assert.equal(fs.existsSync(new URL('../CODEOWNERS', import.meta.url)), false);
  assert.equal(fs.existsSync(new URL('../.github/CODEOWNERS', import.meta.url)), true);
});

test('governance policy requires independent review and fail-closed boundaries', () => {
  assert.match(policy, /No self-approval/);
  assert.match(policy, /protected `main`/);
  assert.match(policy, /fails closed/);
  assert.match(policy, /No silent promotion/);
});
