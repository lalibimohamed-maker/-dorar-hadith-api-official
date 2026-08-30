import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLargeFilePolicy, validateServeRequest } from '../src/media/download-policy.mjs';

test('the application imposes no file-size ceiling', () => {
  const policy = loadLargeFilePolicy();
  assert.equal(policy.policy.applicationMaxFileSizeBytes, null);
  assert.equal(policy.limits.applicationImposedFileSizeLimit, 'none');
});

test('20 GB is only a regression-test case, not a configured maximum', () => {
  const result = validateServeRequest({
    rightsVerified: true,
    malwareClean: true,
    provenanceVerified: true,
    fileSizeBytes: 20 * 1024 * 1024 * 1024,
    byteRange: { start: 0, end: 1024 * 1024 - 1 },
  });
  assert.equal(result.allowed, true);
  assert.equal(result.applicationSizeLimitBytes, null);
  assert.equal(result.rangeSupport, true);
  assert.equal(result.resumable, true);
});

test('publication gates remain mandatory independently of file size', () => {
  const blocked = validateServeRequest({
    rightsVerified: true,
    malwareClean: false,
    provenanceVerified: true,
    fileSizeBytes: 20 * 1024 * 1024 * 1024,
  });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, 'publication-gates-not-satisfied');
});
