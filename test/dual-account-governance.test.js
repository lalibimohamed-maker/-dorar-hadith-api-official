import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const codeowners = fs.readFileSync(new URL('../CODEOWNERS', import.meta.url), 'utf8');
const policy = fs.readFileSync(new URL('../docs/governance/dual-account-algorithmic-governance-2026.md', import.meta.url), 'utf8');

test('dual-account governance keeps ordinary paths jointly maintained', () => {
  assert.match(codeowners, /^\/src\/ @lalibimohamed-maker @lalibimohamed82-coder$/m);
  assert.match(codeowners, /^\/test\/ @lalibimohamed-maker @lalibimohamed82-coder$/m);
  assert.match(codeowners, /^\/docs\/ @lalibimohamed-maker @lalibimohamed82-coder$/m);
});

test('dual-account governance keeps sensitive controls primary-only', () => {
  assert.match(codeowners, /^\/\.github\/ @lalibimohamed-maker$/m);
  assert.match(codeowners, /^\/SECURITY\.md @lalibimohamed-maker$/m);
  assert.match(codeowners, /^\/package-lock\.json @lalibimohamed-maker$/m);
});

test('governance policy requires independent review and fail-closed boundaries', () => {
  assert.match(policy, /No self-approval/);
  assert.match(policy, /protected `main`/);
  assert.match(policy, /fails closed/);
  assert.match(policy, /No silent promotion/);
});
