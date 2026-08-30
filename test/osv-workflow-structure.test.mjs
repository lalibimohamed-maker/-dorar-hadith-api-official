import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/osv-scanner.yml', 'utf8');

test('OSV workflow separates PR/merge-group from scheduled full scans', () => {
  assert.match(workflow, /scan-pr:/);
  assert.match(workflow, /github\.event_name == 'pull_request' \|\| github\.event_name == 'merge_group'/);
  assert.match(workflow, /scan-scheduled:/);
  assert.match(workflow, /github\.event_name == 'push' \|\| github\.event_name == 'schedule' \|\| github\.event_name == 'workflow_dispatch'/);
});

test('OSV workflow is fail-closed and uses isolated SARIF output', () => {
  assert.match(workflow, /--format=sarif/);
  assert.match(workflow, /\$\{\{ runner\.temp \}\}\/osv\/results\.sarif/);
  assert.match(workflow, /test ! -e "\$RUNNER_TEMP\/osv\/results\.sarif"/);
  assert.match(workflow, /-type l/);
});

test('all action references are full commit SHAs', () => {
  const refs = [...workflow.matchAll(/uses:\s+[^\s@]+@([^\s#]+)/g)].map(m => m[1]);
  assert.ok(refs.length >= 4);
  for (const ref of refs) assert.match(ref, /^[0-9a-f]{40}$/i);
});
