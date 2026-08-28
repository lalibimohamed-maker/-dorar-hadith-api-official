import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLargeFilePolicy, validateServeRequest } from '../src/media/download-policy.mjs';

test('large authorized downloads have no application-level size ceiling', () => {
  const policy = loadLargeFilePolicy();
  assert.equal(policy.policy.applicationMaxFileSizeBytes, null);
  assert.equal(policy.limits.applicationImposedFileSizeLimit, 'none');
});
