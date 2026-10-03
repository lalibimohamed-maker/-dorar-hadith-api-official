import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceRuntimeAdapter } from '../apps/mobile/VoiceRuntimeAdapter.js';

test('mobile voice adapter initializes core voice independently of optional dictation', async () => {
  const adapter=createVoiceRuntimeAdapter({
    readPermission:async()=> 'granted',
    requestPermission:async()=> 'granted',
  });
  const ready=await adapter.initialize();
  assert.equal(ready.ready,true);
  assert.equal(adapter.dictation,null);
});

test('mobile voice adapter exposes consent-free transport wiring only, not silent activation', async () => {
  const calls=[];
  const adapter=createVoiceRuntimeAdapter({
    readPermission:async()=> 'granted',
    dictationTransport:{
      createSession:async()=>{calls.push('create'); return {id:'m1'};},
      insertText:async(id,text)=>{calls.push(['insert',id,text]); return {ok:true};},
      cancelSession:async id=>{calls.push(['cancel',id]);},
    },
  });
  await adapter.initialize();
  await adapter.dictation.start();
  await adapter.dictation.insert('السلام عليكم');
  await adapter.dictation.cancel();
  assert.deepEqual(calls,['create',['insert','m1','السلام عليكم'],['cancel','m1']]);
});
