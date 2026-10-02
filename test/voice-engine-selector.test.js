import test from 'node:test';
import assert from 'node:assert/strict';
import { selectRunnableVoiceEngine } from '../src/voice-engine-selector.js';

test('runnable selector binds core Al-Huda engines to observed runtime releases', () => {
  const low=selectRunnableVoiceEngine({capability:'asr',lowPower:true});
  assert.equal(low.engine.id,'qwen3-asr-0.6b');
  assert.equal(low.runnable,true);

  const quality=selectRunnableVoiceEngine({capability:'asr',lowPower:false});
  assert.equal(quality.engine.id,'qwen3-asr-1.7b');
  assert.equal(quality.runnable,true);

  const vad=selectRunnableVoiceEngine({capability:'vad'});
  assert.equal(vad.engine.id,'silero-vad');
  assert.equal(vad.runnable,true);
});

test('runnable selector fails closed for unsupported capabilities', () => {
  assert.throws(()=>selectRunnableVoiceEngine({capability:'unknown'}),/no Al-Huda engine/);
});
