import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelLifecycleManager } from '../src/model-lifecycle-manager.js';

test('model lifecycle separates acquisition from loading and release', async () => {
  const loaded=[], unloaded=[];
  const m=createModelLifecycleManager({load:async id=>loaded.push(id),unload:async id=>unloaded.push(id)});
  m.declare('qwen3-asr-0.6b');
  m.transition('qwen3-asr-0.6b','loadable');
  await m.ensureLoaded('qwen3-asr-0.6b');
  assert.equal(m.get('qwen3-asr-0.6b').state,'loaded');
  await m.release('qwen3-asr-0.6b');
  assert.deepEqual(loaded,['qwen3-asr-0.6b']);
  assert.deepEqual(unloaded,['qwen3-asr-0.6b']);
});
