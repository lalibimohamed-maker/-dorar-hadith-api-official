import test from 'node:test';
import assert from 'node:assert/strict';
import { validateServeRequest } from '../src/media/download-policy.mjs';

test('allows an authorized large-file request without an application size ceiling', () => {
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

test('blocks serving content that has not passed publication gates', () => {
  const result = validateServeRequest({
    rightsVerified: true,
    malwareClean: false,
    provenanceVerified: true,
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'publication-gates-not-satisfied');
});

test('rejects invalid ranges', () => {
  const result = validateServeRequest({
    rightsVerified: true,
    malwareClean: true,
    provenanceVerified: true,
    byteRange: { start: 10, end: 1 },
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'invalid-byte-range');
});
