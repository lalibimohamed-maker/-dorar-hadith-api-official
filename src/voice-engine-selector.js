import { getVoiceEngine } from './voice-engine-intelligence.js';
import { resolveVoiceReleaseRef } from './voice-release-ref-resolver.js';

const RELEASE_MODEL_BY_ENGINE = Object.freeze({
  'qwen3-asr-0.6b': ['rechercher-voice-runtime-2026-10', 'qwen3-asr-0.6b'],
  'qwen3-asr-1.7b': ['rechercher-voice-runtime-2026-10', 'qwen3-asr-1.7b'],
  'silero-vad': ['rechercher-voice-runtime-2026-10', 'sherpa-onnx-vad-silero'],
  'qwen3-forced-aligner-0.6b': ['rechercher-voice-gap-2026-10', 'qwen3-forced-aligner-0.6b'],
  'piper-en-us-libritts-high': ['rechercher-voice-optional-2026-10', 'piper-en-us-libritts-high'],
  'f5-tts-v1-base': ['rechercher-voice-optional-2026-10', 'f5-tts-v1-base'],
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
  if (engine.id === 'qwen3-forced-aligner-0.6b' && (
    tag === 'ar' || tag.startsWith('ar-') || tag.includes('arabic')
  )) return false;
  if (engine.id === 'piper-en-us-libritts-high') return tag === 'en' || tag.startsWith('en-') || tag.includes('english');
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
  const candidates = [];

  for (const id of preferredIds) {
    try {
      const engine = getVoiceEngine(id);
      if (engine.capability === capability && languageEligible(engine, language) && !candidates.some(x => x.id === id)) {
        candidates.push(engine);
      }
    } catch {}
  }

  for (const engine of [
    ...preferredIds.map(id => { try { return getVoiceEngine(id); } catch { return null; } }),
    ...[...new Set(['qwen3-asr-0.6b','qwen3-asr-1.7b','silero-vad','al-huda-kws','qwen3-forced-aligner-0.6b','piper-en-us-libritts-high','f5-tts-v1-base'])]
      .map(id => { try { return getVoiceEngine(id); } catch { return null; } }),
  ]) {
    if (!engine || engine.capability !== capability || !languageEligible(engine, language)) continue;
    if (!candidates.some(x => x.id === engine.id)) candidates.push(engine);
  }

  if (lowPower && capability === 'asr') {
    const lightweight = candidates.find(item => item.id === 'qwen3-asr-0.6b');
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
