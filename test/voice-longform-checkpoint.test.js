import test from 'node:test';
import assert from 'node:assert/strict';
import { createLongFormCheckpointStore } from '../src/voice-longform-checkpoint.js';

test('long-form checkpoints resume after restart with the same manifest', () => {
  const store=createLongFormCheckpointStore();
  store.save({jobId:'book-1',manifestHash:'sha256:abc',chunkIndex:3,totalChunks:10,outputRef:'release://chunk-3'});
  const resumed=store.resume('book-1','sha256:abc');
  assert.equal(resumed.nextChunkIndex,4);
  assert.equal(resumed.resumable,true);
  assert.equal(resumed.outputRef,'release://chunk-3');
});

test('long-form checkpoints fail closed on manifest changes or regressions', () => {
  const store=createLongFormCheckpointStore();
  store.save({jobId:'book-2',manifestHash:'sha256:def',chunkIndex:2,totalChunks:4});
  assert.throws(()=>store.resume('book-2','sha256:other'),/manifest mismatch/);
  assert.throws(()=>store.save({jobId:'book-2',manifestHash:'sha256:def',chunkIndex:1,totalChunks:4}),/regression/);
});

test('long-form checkpoint prevents invalid chunk indexes', () => {
  const store=createLongFormCheckpointStore();
  assert.throws(()=>store.save({jobId:'book-3',manifestHash:'sha256:x',chunkIndex:4,totalChunks:4}),/invalid/);
});
