import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceRuntimeAdapter } from '../apps/mobile/VoiceRuntimeAdapter.js';

test('mobile adapter joins permission lifecycle to runtime bridge', async () => {
  const adapter=createVoiceRuntimeAdapter({
    readPermission:async()=> 'granted',
    requestPermission:async()=> 'granted',
    onEvent:()=>{}
  });
  const result=await adapter.initialize();
  assert.deepEqual(result,{ready:true,permission:'granted'});
  assert.equal(adapter.bridge.state,'ready');
});
