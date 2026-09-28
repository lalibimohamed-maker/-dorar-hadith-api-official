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

test('historical Gitleaks suppressions are finding-level and exact', () => {
  const source = fs.readFileSync('.gitleaksignore', 'utf8');
  const entries = source.split('\n').filter((line) => line && !line.startsWith('#'));
  assert.deepEqual(entries, [
    'bc5864376c6b4acb7242ea43d0276ba231f9d1e8:config/quran-multisource-translation-catalog-2026-09-22.json:generic-api-key:1098',
    '3fc525e539c2ecc3365bc41d65d1771eecedf0ae:config/quranenc-translation-provenance-2026-09-22.json:generic-api-key:618'
  ]);
  assert.equal(entries.every((line) => line.split(':').length === 4), true);
});

test('Gitleaks remains a full-history scan', () => {
  const source = workflowText('.github/workflows/antivirus-analysis-mesh.yml');
  assert.match(source, /fetch-depth:\s*0/);
  assert.match(source, /gitleaks git --redact --report-format sarif/);
});

test('merge-queue security changes are workflow/security plumbing only', () => {
  assert.equal(fs.existsSync('.gitleaksignore'), true);
  const workflowPaths = [...requiredContexts.values(), '.github/workflows/antivirus-analysis-mesh.yml'];
  assert.equal(workflowPaths.every((path) => path.startsWith('.github/workflows/')), true);
});
