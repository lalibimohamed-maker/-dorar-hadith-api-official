import test from 'node:test';
import assert from 'node:assert/strict';
import { createNativeDictationSession } from '../src/native-dictation-session.js';

test('native dictation session creates, inserts and cancels one focused session', async () => {
  const calls=[];
  const session=createNativeDictationSession({
    transport:{
      createSession:async()=>{calls.push(['create']);return {id:'s1'};},
      insertText:async(id,text)=>{calls.push(['insert',id,text]);return {ok:true};},
      cancelSession:async id=>{calls.push(['cancel',id]);},
    }
  });
  await session.start();
  await session.insert('السلام عليكم');
  const result=await session.cancel();
  assert.equal(result.cancelled,true);
  assert.equal(session.active,false);
  assert.deepEqual(calls,[['create'],['insert','s1','السلام عليكم'],['cancel','s1']]);
});

test('native dictation session rejects empty input and stale use', async () => {
  const session=createNativeDictationSession({
    transport:{
      createSession:async()=>({id:'s2'}),
      insertText:async()=>({}),
      cancelSession:async()=>{},
    }
  });
  await assert.rejects(()=>session.insert('نص'),/not active/);
  await session.start();
  await assert.rejects(()=>session.insert('   '),/must not be empty/);
  await session.cancel();
  await assert.rejects(()=>session.insert('بعد الإلغاء'),/not active/);
});

test('native dictation session clears state even when cancellation transport fails', async () => {
  const session=createNativeDictationSession({
    transport:{
      createSession:async()=>({id:'s3'}),
      insertText:async()=>({}),
      cancelSession:async()=>{throw new Error('transport failure');},
    }
  });
  await session.start();
  await assert.rejects(()=>session.cancel(),/transport failure/);
  assert.equal(session.active,false);
  assert.equal(session.sessionId,null);
});
