import fs from 'node:fs';
import path from 'node:path';

const CONFIG_PATH = path.resolve('config/large-file-delivery-policy-2026.json');

export function loadLargeFilePolicy() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

export function validateServeRequest({ rightsVerified, malwareClean, provenanceVerified, byteRange = null, fileSizeBytes = null }) {
  const policy = loadLargeFilePolicy();
  if (!rightsVerified || !malwareClean || !provenanceVerified) {
    return { allowed: false, reason: 'publication-gates-not-satisfied' };
  }
  if (byteRange && (!Number.isInteger(byteRange.start) || !Number.isInteger(byteRange.end) || byteRange.start < 0 || byteRange.end < byteRange.start)) {
    return { allowed: false, reason: 'invalid-byte-range' };
  }
  if (fileSizeBytes != null && (!Number.isInteger(fileSizeBytes) || fileSizeBytes < 0)) {
    return { allowed: false, reason: 'invalid-file-size' };
  }
  return {
    allowed: true,
    rangeSupport: policy.policy.allowRangeRequests,
    resumable: policy.policy.allowResumableDownloads,
    applicationSizeLimitBytes: policy.policy.applicationMaxFileSizeBytes,
  };
}
