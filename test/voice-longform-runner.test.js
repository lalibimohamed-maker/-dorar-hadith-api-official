import test from 'node:test';
import assert from 'node:assert/strict';
import { createLongFormCheckpointStore } from '../src/voice-longform-checkpoint.js';
import { renderLongFormJob } from '../src/voice-longform-runner.js';

test('long-form runner checkpoints every rendered chunk and resumes', async () => {
  const store=createLongFormCheckpointStore();
  const rendered=[];
  await renderLongFormJob({
    jobId:'audio-book-1',
    manifestHash:'sha256:book',
    chunks:['a','b','c'],
    checkpointStore:store,
    renderChunk:async(chunk)=>{ rendered.push(chunk); return `release://${chunk}`; },
  });
  assert.deepEqual(rendered,['a','b','c']);

  const resumed=[];
  const result=await renderLongFormJob({
    jobId:'audio-book-1',
    manifestHash:'sha256:book',
    chunks:['a','b','c','d'],
    checkpointStore:store,
    renderChunk:async(chunk)=>{ resumed.push(chunk); return `release://${chunk}`; },
  });
  assert.deepEqual(resumed,['d']);
  assert.deepEqual(result.outputs,['release://d']);
  assert.equal(result.resumedFrom,3);
});
