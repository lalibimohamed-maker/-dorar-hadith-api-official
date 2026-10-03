import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioRuntime } from '../src/audio-runtime.js';

test('audio runtime exposes endpointing and barge-in contract', () => {
  const events=[];
  const a=createAudioRuntime({vad:()=>true,endpointing:()=>false,onEvent:e=>events.push(e)});
  assert.deepEqual(a.processFrame(new Float32Array([0])),{speech:true,boundary:false});
  a.speechStarted(); a.bargeIn();
  assert.equal(a.status.interrupted,true);
  assert.equal(events.at(-1).cancellationRequired,true);
});
