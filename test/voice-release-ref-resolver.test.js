import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveVoiceReleaseRef, isReleaseRuntimeVerified } from '../src/voice-release-ref-resolver.js';

test('runtime voice release references are pinned to observed assets and digests', () => {
  const qwen=resolveVoiceReleaseRef({modelId:'qwen3-asr-0.6b'});
  assert.deepEqual(qwen.assets,['Qwen3-ASR-0.6B.tar.bz2']);
  assert.equal(qwen.runtimeVerified,true);
  assert.match(qwen.digests[0],/^sha256:/);

  const large=resolveVoiceReleaseRef({modelId:'qwen3-asr-1.7b'});
  assert.equal(large.assets.length,3);
  assert.equal(isReleaseRuntimeVerified(large),true);
});

test('release resolver fails closed for unknown releases or models', () => {
  assert.throws(()=>resolveVoiceReleaseRef({modelId:'missing'}),/not published/);
  assert.throws(()=>resolveVoiceReleaseRef({releaseTag:'missing-release',modelId:'qwen3-asr-0.6b'}),/unknown voice release/);
});
