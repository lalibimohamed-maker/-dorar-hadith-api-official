import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeakerRuntime } from '../src/speaker-runtime.js';
import { createDiarizationRuntime } from '../src/diarization-runtime.js';
import { createAudioEventRuntime } from '../src/audio-event-runtime.js';
import { createPunctuationRuntime } from '../src/punctuation-runtime.js';

test('speaker runtime enrolls and identifies a profile', async () => {
  const s=createSpeakerRuntime({embed:async x=>x});
  await s.enroll('speaker-1',[1,0]);
  assert.equal((await s.identify([1,0])).id,'speaker-1');
});

test('diarization normalizes speaker segments', async () => {
  const d=createDiarizationRuntime({segment:async()=>[{speaker:'0',startMs:0,endMs:250,confidence:.9}]});
  assert.deepEqual(await d.diarize('audio'),[{speaker:'0',startMs:0,endMs:250,confidence:.9}]);
});

test('audio event runtime normalizes events', async () => {
  const a=createAudioEventRuntime({classify:async()=>[{label:'door',confidence:.8}]});
  assert.equal((await a.detect('audio'))[0].label,'door');
});

test('punctuation runtime rejects empty output', async () => {
  const p=createPunctuationRuntime({punctuate:async t=>t+'؟'});
  assert.equal(await p.execute('كيف الحال'),'كيف الحال؟');
});
