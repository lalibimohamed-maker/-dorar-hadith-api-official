import assert from 'node:assert/strict';
import test from 'node:test';
import { auditSourceRegistry } from '../src/source-registry-quality.js';

test('source registry has unique source identities', () => {
  const audit = auditSourceRegistry({ sources: [
    { id: 'a', nameAr: 'A', attributionRequired: true, publisher: 'P' },
    { id: 'b', nameAr: 'B', attributionRequired: true, publisher: 'P' }
  ]});
  assert.equal(audit.valid, true);
  assert.equal(audit.duplicateIds.length, 0);
});

test('quality gate detects duplicate identities and missing attribution', () => {
  const audit = auditSourceRegistry({ sources: [
    { id: 'a', nameAr: 'A', attributionRequired: true, publisher: 'P' },
    { id: 'a', nameAr: 'A2', attributionRequired: true }
  ]});
  assert.equal(audit.valid, false);
  assert.deepEqual(audit.duplicateIds, ['a']);
  assert.deepEqual(audit.missingAttribution, ['a']);
});

test('verification is reported separately from registry validity', () => {
  const audit = auditSourceRegistry({ sources: [
    { id: 'a', nameAr: 'A', attributionRequired: true, publisher: 'P', verificationState: 'pending' },
    { id: 'b', nameAr: 'B', attributionRequired: true, publisher: 'P', verificationState: 'source_verified' }
  ]});
  assert.equal(audit.valid, true);
  assert.equal(audit.verified, 1);
  assert.equal(audit.unverified, 1);
});
