import test from 'node:test';
import assert from 'node:assert/strict';
import { selectRunnableVoiceEngine } from '../src/voice-engine-selector.js';

test('runnable selector binds core Al-Huda engines to observed runtime releases', () => {
  const low=selectRunnableVoiceEngine({capability:'asr',lowPower:true});
  assert.equal(low.engine.id,'qwen3-asr-0.6b');
  assert.equal(low.runnable,true);

  const quality=selectRunnableVoiceEngine({capability:'asr',lowPower:false});
  assert.equal(quality.engine.id,'qwen3-asr-1.7b');
  assert.equal(quality.runnable,true);

  const fallback=selectRunnableVoiceEngine({
    capability:'asr',
    preferred:['whisper-cpp-ggml-base-multilingual'],
  });
  assert.equal(fallback.engine.id,'whisper-cpp-ggml-base-multilingual');
  assert.equal(fallback.runnable,true);

  const vad=selectRunnableVoiceEngine({capability:'vad'});
  assert.equal(vad.engine.id,'silero-vad');
  assert.equal(vad.runnable,true);
});

test('runnable selector fails closed for unsupported capabilities', () => {
  assert.throws(()=>selectRunnableVoiceEngine({capability:'unknown'}),/no Al-Huda engine/);
});

test('runnable selector resolves the verified Al-Huda wake-word release', () => {
  const wake = selectRunnableVoiceEngine({ capability: 'wake-word' });
  assert.equal(wake.engine.id, 'al-huda-kws');
  assert.equal(wake.release.releaseTag, 'al-huda-kws-2026-10');
  assert.equal(wake.runnable, true);
});

test('runnable selector exposes Qwen3 ForcedAligner only for supported non-Arabic languages', () => {
  const aligner = selectRunnableVoiceEngine({
    capability: 'forced-alignment',
    preferred: ['qwen3-forced-aligner-0.6b'],
    language: 'en-US',
  });
  assert.equal(aligner.engine.id, 'qwen3-forced-aligner-0.6b');
  assert.equal(aligner.runnable, true);
  assert.throws(
    () => selectRunnableVoiceEngine({
      capability: 'forced-alignment',
      preferred: ['qwen3-forced-aligner-0.6b'],
      language: 'ar',
    }),
    /no Al-Huda engine/
  );
});

test('runnable selector can use the verified English Piper fallback without making it an Arabic default', () => {
  const tts = selectRunnableVoiceEngine({
    capability: 'tts',
    preferred: ['piper-en-us-libritts-high'],
    language: 'en-US',
  });
  assert.equal(tts.engine.id, 'piper-en-us-libritts-high');
  assert.equal(tts.release.releaseTag, 'rechercher-voice-optional-2026-10');
  assert.equal(tts.runnable, true);

  assert.throws(
    () => selectRunnableVoiceEngine({
      capability: 'tts',
      preferred: ['piper-en-us-libritts-high'],
      language: 'ar',
    }),
    /no Al-Huda engine/
  );
});

test('runnable selector keeps license/runtime-pending F5-TTS out of runnable execution', () => {
  const f5 = selectRunnableVoiceEngine({
    capability: 'tts',
    preferred: ['f5-tts-v1-base'],
    language: 'en-US',
  });
  assert.equal(f5.engine.id, 'f5-tts-v1-base');
  assert.equal(f5.release.runtimeVerified, false);
  assert.equal(f5.runnable, false);
});


test('runnable selector resolves the runtime-verified GTCRN speech enhancement release', () => {
  const denoiser = selectRunnableVoiceEngine({
    capability: 'speech-enhancement',
  });
  assert.equal(denoiser.engine.id, 'sherpa-onnx-gtcrn-noise-suppression');
  assert.equal(denoiser.release.releaseTag, 'rechercher-voice-gap-2026-10');
  assert.equal(denoiser.runnable, true);
});
