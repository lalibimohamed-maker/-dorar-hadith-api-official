import { getVoiceEngine } from './voice-engine-intelligence.js';
import { resolveVoiceReleaseRef } from './voice-release-ref-resolver.js';

export function selectRunnableVoiceEngine({
  capability,
  lowPower = false,
  preferred = [],
  releaseTag = 'rechercher-voice-runtime-2026-10',
} = {}) {
  const engine = (() => {
    try {
      return getVoiceEngine(preferred.find(id => {
        try {
          return getVoiceEngine(id).capability === capability;
        } catch {
          return false;
        }
      }));
    } catch {
      return null;
    }
  })();

  const fallbackId = capability === 'asr'
    ? (lowPower ? 'qwen3-asr-0.6b' : 'qwen3-asr-1.7b')
    : capability === 'vad' ? 'silero-vad' : null;

  const selected = engine && !lowPower
    ? engine
    : fallbackId ? getVoiceEngine(fallbackId) : engine;

  if (!selected) throw new Error(`no Al-Huda engine for capability: ${capability}`);

  const release = selected.id === 'qwen3-asr-0.6b'
    ? resolveVoiceReleaseRef({ releaseTag, modelId: 'qwen3-asr-0.6b' })
    : selected.id === 'qwen3-asr-1.7b'
      ? resolveVoiceReleaseRef({ releaseTag, modelId: 'qwen3-asr-1.7b' })
      : selected.id === 'silero-vad'
        ? resolveVoiceReleaseRef({ releaseTag, modelId: 'sherpa-onnx-vad-silero' })
        : null;

  return Object.freeze({
    engine: selected,
    release,
    runnable: release?.runtimeVerified === true,
  });
}
