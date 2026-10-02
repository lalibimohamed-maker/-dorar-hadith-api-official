import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceStreamRuntime } from '../src/voice-stream-runtime.js';

test('voice stream runtime emits monotonic ASR partial/final events', () => {
  const events=[];
  const stream=createVoiceStreamRuntime({onEvent:e=>events.push(e)});
  assert.equal(stream.startASR({sessionId:'s1'}).sequence,1);
  assert.equal(stream.partialASR('السلام').sequence,2);
  assert.equal(stream.finalASR('السلام عليكم').sequence,3);
  assert.equal(stream.completeASR().sequence,4);
  assert.deepEqual(events.map(e=>e.type),['started','partial','final','completed']);
  assert.equal(stream.state.asr,'completed');
});

test('voice stream runtime requires real terminal ordering', () => {
  const stream=createVoiceStreamRuntime();
  assert.throws(()=>stream.partialASR('قبل البدء'),/requires started/);
  stream.startTTS();
  stream.chunkTTS('audio://chunk-1');
  stream.completeTTS();
  assert.throws(()=>stream.chunkTTS('audio://chunk-2'),/already terminated/);
});

test('voice stream runtime rejects empty ASR payloads', () => {
  const stream=createVoiceStreamRuntime();
  stream.startASR();
  assert.throws(()=>stream.partialASR('   '),/must not be empty/);
});
