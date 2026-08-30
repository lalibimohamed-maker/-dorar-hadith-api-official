import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const policy = JSON.parse(fs.readFileSync('config/large-file-delivery-policy-2026.json', 'utf8'));

test('large-file policy has no application-imposed file-size ceiling', () => {
  assert.equal(policy.policy.applicationMaxFileSizeBytes, null);
  assert.equal(policy.limits.applicationImposedFileSizeLimit, 'none');
});

test('large authorized delivery keeps range, resume, chunking and integrity gates', () => {
  for (const flag of ['allowRangeRequests', 'allowResumableDownloads', 'allowChunkedTransfer', 'allowParallelChunks', 'verifySha256BeforeServe', 'rightsCheckBeforeServe', 'sourceProvenanceRequired', 'malwareScanRequired']) {
    assert.equal(policy.policy[flag], true, flag);
  }
});

test('infrastructure limits are not application policy limits', () => {
  assert.ok(policy.limits.realInfrastructureLimitsRemain.includes('storage-capacity'));
  assert.ok(policy.limits.realInfrastructureLimitsRemain.includes('bandwidth'));
  assert.ok(policy.limits.realInfrastructureLimitsRemain.includes('browser/device-capability'));
});
