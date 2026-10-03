import test from 'node:test';
import assert from 'node:assert/strict';
import { createMobileRuntimeBridge } from '../src/mobile-runtime-bridge.js';

test('mobile bridge follows local voice lifecycle', () => {
  const events=[];
  const b=createMobileRuntimeBridge({onEvent:e=>events.push(e)});
  b.requestPermission(); b.ready(); b.startListening(); b.wakeDetected(); b.startTranscription(); b.startReasoning(); b.startSpeaking(); b.interrupt();
  assert.equal(b.state,'interrupted');
  assert.equal(events.at(-1).reason,'user-barge-in');
});
