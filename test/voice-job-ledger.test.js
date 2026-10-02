import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceJobLedger } from '../src/voice-job-ledger.js';

test('voice jobs are idempotent by key and manifest', () => {
  const ledger=createVoiceJobLedger();
  const first=ledger.begin({idempotencyKey:'job-1',jobType:'transcribe',manifestHash:'sha:a'});
  const reused=ledger.begin({idempotencyKey:'job-1',jobType:'transcribe',manifestHash:'sha:a'});
  assert.equal(reused.reused,true);
  assert.equal(reused.idempotencyKey,first.idempotencyKey);
  assert.throws(
    ()=>ledger.begin({idempotencyKey:'job-1',jobType:'transcribe',manifestHash:'sha:b'}),
    /different manifest/
  );
});

test('voice jobs can terminate once and cancellation is terminal', () => {
  const events=[];
  const ledger=createVoiceJobLedger({onEvent:e=>events.push(e)});
  ledger.begin({idempotencyKey:'job-2',jobType:'tts'});
  const cancelled=ledger.cancel('job-2');
  assert.equal(cancelled.state,'cancelled');
  assert.throws(()=>ledger.finish({idempotencyKey:'job-2',state:'completed'}),/already terminated/);
  assert.ok(events.some(e=>e.type==='job.started'));
  assert.ok(events.some(e=>e.type==='job.cancelled'));
});
