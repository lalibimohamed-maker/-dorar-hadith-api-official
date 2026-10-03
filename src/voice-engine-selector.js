import { getVoiceEngine } from './voice-engine-intelligence.js';
import { resolveVoiceReleaseRef } from './voice-release-ref-resolver.js';

const RELEASE_MODEL_BY_ENGINE = Object.freeze({
  'qwen3-asr-0.6b': ['rechercher-voice-runtime-2026-10', 'qwen3-asr-0.6b'],
  'qwen3-asr-1.7b': ['rechercher-voice-runtime-2026-10', 'qwen3-asr-1.7b'],
  'whisper-cpp-ggml-base-multilingual': ['rechercher-voice-fallback-2026-10', 'whisper-cpp-ggml-base-multilingual'],
  'silero-vad': ['rechercher-voice-runtime-2026-10', 'sherpa-onnx-vad-silero'],
  'qwen3-forced-aligner-0.6b': ['rechercher-voice-gap-2026-10', 'qwen3-forced-aligner-0.6b'],
  'piper-en-us-libritts-high': ['rechercher-voice-optional-2026-10', 'piper-en-us-libritts-high'],
  'f5-tts-v1-base': ['rechercher-voice-optional-2026-10', 'f5-tts-v1-base'],
  'sherpa-onnx-gtcrn-noise-suppression': ['rechercher-voice-gap-2026-10', 'sherpa-onnx-gtcrn-noise-suppression'],
});

const DEFAULT_ENGINE_IDS = Object.freeze({
  asr: ['qwen3-asr-1.7b', 'qwen3-asr-0.6b', 'whisper-cpp-ggml-base-multilingual'],
  vad: ['silero-vad'],
  'wake-word': ['al-huda-kws'],
  'forced-alignment': ['qwen3-forced-aligner-0.6b'],
  'speech-enhancement': ['sherpa-onnx-gtcrn-noise-suppression'],
  tts: ['piper-en-us-libritts-high', 'f5-tts-v1-base'],
});

function resolveEngineRelease(engineId, releaseTag = null) {
  const pair = RELEASE_MODEL_BY_ENGINE[engineId];
  if (!pair) {
    if (engineId === 'al-huda-kws') {
      return resolveVoiceReleaseRef({
        releaseTag: 'al-huda-kws-2026-10',
        modelId: 'al-huda-kws',
      });
    }
    return null;
  }
  return resolveVoiceReleaseRef({
    releaseTag: releaseTag || pair[0],
    modelId: pair[1],
  });
}

function languageEligible(engine, language) {
  if (!language) return true;
  const tag = String(language).toLowerCase();
  const base = tag.split('-')[0];

  if (Array.isArray(engine.supportedLanguages) && engine.supportedLanguages.length > 0) {
    if (!engine.supportedLanguages.some((item) => String(item).toLowerCase() === base)) return false;
  }

  if (engine.id === 'piper-en-us-libritts-high') {
    return base === 'en' || tag.includes('english');
  }

  return true;
}

export function selectRunnableVoiceEngine({
  capability,
  lowPower = false,
  preferred = [],
  language = null,
  releaseTag = null,
} = {}) {
  const preferredIds = Array.isArray(preferred) ? preferred : [];
  if ((capability === 'tts' || capability === 'forced-alignment') && !language) {
    throw new Error('explicit language required');
  }

  const orderedIds = preferredIds.length > 0
    ? preferredIds
    : (DEFAULT_ENGINE_IDS[capability] || []);

  const candidates = [];
  for (const id of orderedIds) {
    if (candidates.some((x) => x.id === id)) continue;
    try {
      const engine = getVoiceEngine(id);
      if (engine.capability === capability && languageEligible(engine, language)) {
        candidates.push(engine);
      }
    } catch {}
  }

  if (lowPower && capability === 'asr') {
    const lightweight = candidates.find((item) => item.id === 'qwen3-asr-0.6b');
    if (lightweight) candidates.splice(0, candidates.length, lightweight);
  }

  const selected = candidates[0];
  if (!selected) throw new Error(`no Al-Huda engine for capability: ${capability}`);

  const release = resolveEngineRelease(selected.id, releaseTag);
  return Object.freeze({
    engine: selected,
    release,
    runnable: release?.runtimeVerified === true,
  });
}
