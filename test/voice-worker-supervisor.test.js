import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceWorkerSupervisor } from '../src/voice-worker-supervisor.js';

test('voice worker supervisor restarts after a crash with increasing generation', async () => {
  let launches=0;
  const sup=createVoiceWorkerSupervisor({
    start:async ctx=>({ctx,launch:++launches}),
    stop:async()=>{},
    backoffMs:[0,0,0],
    sleep:async()=>{},
  });
  const first=await sup.launch();
  const second=await sup.recover(new Error('worker crash'));
  assert.equal(first.generation,1);
  assert.equal(second.generation,2);
  assert.equal(sup.crashCount,1);
  assert.equal(sup.running,true);
});

test('voice worker supervisor stops a repeated crash loop after the limit', async () => {
  const sup=createVoiceWorkerSupervisor({
    start:async()=>({}),
    stop:async()=>{},
    maxCrashes:3,
    backoffMs:[0,0],
    sleep:async()=>{},
  });
  await sup.launch();
  await sup.recover(new Error('1'));
  await sup.recover(new Error('2'));
  await assert.rejects(()=>sup.recover(new Error('3')),/crash loop backoff exhausted/);
});
