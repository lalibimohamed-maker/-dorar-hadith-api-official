import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const policy = JSON.parse(fs.readFileSync('config/large-file-delivery-policy-2026.json', 'utf8'));

test('mainline large-file policy has no application-imposed file-size ceiling', () => {
  assert.equal(policy.policy.applicationMaxFileSizeBytes, null);
  assert.equal(policy.limits.applicationImposedFileSizeLimit, 'none');
});

test('large-file delivery keeps resumable/range/chunking capabilities and publication gates', () => {
  assert.equal(policy.policy.allowRangeRequests, true);
  assert.equal(policy.policy.allowResumableDownloads, true);
  assert.equal(policy.policy.allowChunkedTransfer, true);
  assert.equal(policy.policy.allowParallelChunks, true);
  assert.equal(policy.policy.rightsCheckBeforeServe, true);
  assert.equal(policy.policy.sourceProvenanceRequired, true);
  assert.equal(policy.policy.malwareScanRequired, true);
  assert.equal(policy.policy.verifySha256BeforeServe, true);
});
