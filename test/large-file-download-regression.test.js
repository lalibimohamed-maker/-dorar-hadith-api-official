import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLargeFilePolicy, validateServeRequest } from '../src/media/download-policy.mjs';

test('large authorized downloads have no application-level size ceiling', () => {
  const policy = loadLargeFilePolicy();
  assert.equal(policy.policy.applicationMaxFileSizeBytes, null);
  assert.equal(policy.limits.applicationImposedFileSizeLimit, 'none');
});

test('20 GB authorized media can pass the application delivery policy', () => {
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

test('PDF, video, audio and image downloads use publication gates rather than a fixed 20 MB cap', () => {
  const policy = loadLargeFilePolicy();
  assert.equal(policy.limits.applicationImposedFileSizeLimit, 'none');
  assert.equal(policy.policy.rightsCheckBeforeServe, true);
  assert.equal(policy.policy.malwareScanRequired, true);
  assert.equal(policy.policy.sourceProvenanceRequired, true);
});
