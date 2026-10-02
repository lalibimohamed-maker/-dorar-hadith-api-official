import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoicePermissionLifecycle } from '../src/voice-permission-lifecycle.js';
import { createVoiceResourceGovernor } from '../src/voice-resource-governor.js';

test('permission lifecycle transitions', async () => {
  const p=createVoicePermissionLifecycle({readPermission:async()=> 'denied', requestPermission:async()=> 'granted'});
  assert.equal(await p.refresh(),'denied');
  assert.equal(await p.request(),'granted');
  assert.equal(p.state,'granted');
});

test('resource governor downgrades under pressure', () => {
  const g=createVoiceResourceGovernor();
  assert.equal(g.selectModel({memoryMb:256,cpuPercent:20,thermal:'nominal'}).model,'qwen3-asr-0.6b');
  assert.equal(g.selectModel({memoryMb:4096,cpuPercent:10,thermal:'nominal'}).model,'qwen3-asr-1.7b');
  assert.equal(g.selectModel({memoryMb:4096,cpuPercent:10,thermal:'critical'}).model,'qwen3-asr-0.6b');
});
