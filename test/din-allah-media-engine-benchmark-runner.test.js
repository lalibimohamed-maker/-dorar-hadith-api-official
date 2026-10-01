import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScorecard } from '../src/din-allah-media-engine-benchmark-runner.js';

test('benchmark runner blocks missing provenance and rights', () => {
  const result = buildScorecard({
    candidate: 'wan2.2',
    promptId: 'ant-macro-01',
    videoPath: '/does/not/exist.mp4',
    provenance: { status: 'missing' },
    rights: { status: 'unknown' },
  });
  assert.equal(result.status, 'blocked');
  assert.equal(result.hardFail, true);
  assert.ok(result.failedGates.includes('video_integrity'));
  assert.ok(result.failedGates.includes('provenance'));
  assert.ok(result.failedGates.includes('rights'));
});

test('benchmark runner does not invent benchmark scores', () => {
  const result = buildScorecard({
    candidate: 'wan2.2',
    promptId: 'ant-macro-01',
    videoPath: '/does/not/exist.mp4',
    provenance: { status: 'complete' },
    rights: { status: 'verified' },
  });
  assert.equal(result.scores, null);
});
