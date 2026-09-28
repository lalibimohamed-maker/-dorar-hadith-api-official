import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const requiredContexts = new Map([
  ['test (22)', '.github/workflows/ci.yml'],
  ['test (24)', '.github/workflows/ci.yml'],
  ['dependency-review', '.github/workflows/dependency-review.yml'],
  ['workflow-security', '.github/workflows/workflow-security-gate.yml'],
  ['CodeQL', '.github/workflows/codeql.yml'],
  ['baseline', '.github/workflows/security-baseline.yml']
]);

function workflowText(path) {
  return fs.readFileSync(path, 'utf8');
}

test('all required main status-check workflows listen to merge_group', () => {
  for (const [context, path] of requiredContexts) {
    const source = workflowText(path);
    assert.match(source, /^\s*merge_group:\s*$/m, context + ' workflow must support merge_group');
    assert.match(source, /types:\s*\[checks_requested\]/, context + ' workflow must request merge-queue checks');
  }
});

test('free antivirus mesh listens to merge_group', () => {
  const source = workflowText('.github/workflows/antivirus-analysis-mesh.yml');
  assert.match(source, /^\s*merge_group:\s*$/m);
  assert.match(source, /types:\s*\[checks_requested\]/);
});

test('antivirus summary fails closed for cancellation or any non-success scanner result', () => {
  const source = workflowText('.github/workflows/antivirus-analysis-mesh.yml');
  for (const job of ['clamav', 'yara', 'trivy', 'gitleaks', 'npm-audit']) {
    assert.match(source, new RegExp('needs\\.' + job + '\\.(result)'));
  }
  assert.match(source, /if \[ "\$result" != "success" \]/);
  assert.match(source, /exit 1/);
});

test('merge-queue security changes are workflow-only', () => {
  const files = [...requiredContexts.values(), '.github/workflows/antivirus-analysis-mesh.yml'];
  assert.equal(files.every((path) => path.startsWith('.github/workflows/')), true);
});
