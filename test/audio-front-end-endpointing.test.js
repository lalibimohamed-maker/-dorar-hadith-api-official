import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioFrontEnd } from '../src/audio-front-end.js';
import { createEndpointing } from '../src/endpointing.js';
import { createBargeInEngine } from '../src/barge-in-engine.js';
import { createAudioFramePipeline } from '../src/audio-frame-pipeline.js';

test('audio front-end applies gain and detects clipping', () => {
  const f=createAudioFrontEnd();
  const r=f.process(new Float32Array([0.2,-0.2]));
  assert.equal(r.clipped,false);
  assert.ok(r.gain > 1);
});

test('endpointing opens after speech frames and closes after silence frames', () => {
  const e=createEndpointing({startSpeechFrames:2,endSilenceFrames:2});
  assert.equal(e.push(true).active,false);
  assert.equal(e.push(true).speechStarted,true);
  assert.equal(e.push(false).active,true);
  assert.equal(e.push(false).speechEnded,true);
});

test('barge-in aborts the active speech output', () => {
  const b=createBargeInEngine();
  const signal=b.start();
  assert.equal(signal.aborted,false);
  b.interrupt();
  assert.equal(signal.aborted,true);
  assert.equal(b.interrupted,true);
});

test('audio frame pipeline composes front-end, VAD and endpointing', () => {
  const p=createAudioFramePipeline({
    frontEnd:createAudioFrontEnd(),
    vad:()=>true,
    endpointing:createEndpointing({startSpeechFrames:1,endSilenceFrames:1})
  });
  assert.equal(p.process(new Float32Array([0.1])).speech,true);
  assert.equal(p.process(new Float32Array([0.1])).turn.active,true);
});
