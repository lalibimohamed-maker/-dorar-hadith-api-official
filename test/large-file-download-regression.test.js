import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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

test('quality ladder is open-ended and exposes preferred 24K/16K/12K/8K/4K tiers', () => {
  const quality = JSON.parse(fs.readFileSync('config/media-quality-ladder-2026.json', 'utf8'));
  assert.equal(quality.master.maxResolution, null);
  assert.equal(quality.master.upscaleLowerResolutionAsNative, false);
  assert.deepEqual(quality.preferredDownloadTiers.map((tier) => tier.label), ['24K', '16K', '12K', '8K', '4K']);
  assert.equal(quality.selection.allowManualQualityChoice, true);
  assert.equal(quality.selection.showOnlyExistingDerivatives, true);
  assert.equal(quality.trueResolution.24KMeansNativeDetail, true);
  assert.equal(quality.trueResolution.forbidMisleadingUpscaleLabel, true);
  assert.equal(quality.freeFirst.paidApiRequired, false);
  assert.equal(quality.freeFirst.subscriptionRequired, false);
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
