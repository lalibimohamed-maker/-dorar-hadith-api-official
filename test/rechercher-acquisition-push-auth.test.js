import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const workflow = fs.readFileSync('.github/workflows/rechercher-governed-acquisition.yml', 'utf8');

test('central governed acquisition keeps checkout credentials non-persistent', () => {
  assert.match(workflow, /persist-credentials:\s*false/);
});

test('primary acquisition sync uses explicit HTTPS auth for fetch, LFS push and push', () => {
  assert.match(workflow, /GIT_AUTH_HEADER=.*GITHUB_TOKEN/);
  assert.match(workflow, /git -c "http\.extraheader=\$\{GIT_AUTH_HEADER\}" fetch origin "\$TARGET_BRANCH"/);
  assert.match(workflow, /git -c "http\.extraheader=\$\{GIT_AUTH_HEADER\}" lfs push --dry-run origin HEAD/);
  assert.match(workflow, /git -c "http\.extraheader=\$\{GIT_AUTH_HEADER\}" push origin "HEAD:refs\/heads\/\$TARGET_BRANCH"/);
});

test('secondary acquisition sync uses explicit HTTPS auth for fetch, LFS push and push', () => {
  assert.match(workflow, /GIT_AUTH_HEADER=.*SECONDARY_STORAGE_TOKEN/);
  assert.match(workflow, /git -c "http\.extraheader=\$\{GIT_AUTH_HEADER\}" fetch origin main/);
  assert.match(workflow, /git -c "http\.extraheader=\$\{GIT_AUTH_HEADER\}" lfs push --dry-run origin HEAD/);
  assert.match(workflow, /git -c "http\.extraheader=\$\{GIT_AUTH_HEADER\}" push origin HEAD:refs\/heads\/main/);
});

test('interactive Git credential prompts remain disabled', () => {
  assert.match(workflow, /GIT_TERMINAL_PROMPT:\s*['"]0['"]/);
});
