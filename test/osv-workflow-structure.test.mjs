import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/osv-scanner.yml', 'utf8');

test('OSV workflow separates PR/merge-group from scheduled full scans', () => {
  assert.match(workflow, /scan-pr:/);
  assert.match(workflow, /event_name == 'pull_request' \|\| github\.event_name == 'merge_group'/);
  assert.match(workflow, /osv-scanner-reusable-pr\.yml@/);
  assert.match(workflow, /scan-scheduled:/);
  assert.match(workflow, /event_name == 'push' \|\| github\.event_name == 'schedule' \|\| github\.event_name == 'workflow_dispatch'/);
  assert.match(workflow, /osv-scanner-reusable\.yml@/);
});

test('OSV jobs use the official SARIF-capable reusable workflows', () => {
  assert.match(workflow, /google\/osv-scanner-action\/\.github\/workflows\/osv-scanner-reusable\.yml@/);
  assert.match(workflow, /google\/osv-scanner-action\/\.github\/workflows\/osv-scanner-reusable-pr\.yml@/);
  assert.doesNotMatch(workflow, /--format=sarif/);
  assert.doesNotMatch(workflow, /runner\.temp\/osv\/results\.sarif/);
});

test('all GitHub action references are full commit SHAs', () => {
  const refs = [...workflow.matchAll(/uses:\s+[^\s@]+@([^\s#]+)/g)].map(m => m[1]);
  assert.ok(refs.length >= 3);
  for (const ref of refs) assert.match(ref, /^[0-9a-f]{40}$/i);
});

test('least-privilege permissions are explicit', () => {
  assert.match(workflow, /permissions:\s*\{\}/);
  for (const permission of ['actions: read', 'contents: read', 'security-events: write']) assert.match(workflow, new RegExp(permission));
});
