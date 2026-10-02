import test from 'node:test';
import assert from 'node:assert/strict';
import { createAlHudaWakeWordProvider } from '../src/al-huda-wakeword-provider.js';

test('Al-Huda wake word provider declares wake-word capability',()=>{
  const p=createAlHudaWakeWordProvider({modelPath:'/tmp/not-real.onnx'});
  assert.equal(p.supports('wake-word'),true);
  assert.equal(p.supports('speech-to-text'),false);
});
