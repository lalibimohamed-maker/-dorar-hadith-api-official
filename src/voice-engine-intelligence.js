const CATALOG = Object.freeze({
  "qwen3-asr-0.6b": { capability: "asr", profile: "low-power", localFirst: true, status: "runnable-release-verified" },
  "qwen3-asr-1.7b": { capability: "asr", profile: "quality", localFirst: true, status: "runnable-release-verified" },
  "silero-vad": { capability: "vad", profile: "endpointing", localFirst: true, status: "runnable-release-verified" },
  "sherpa-onnx-punctuation": { capability: "punctuation", profile: "post-asr", localFirst: true, status: "acquired-review-evidence-pending" },
  "sherpa-onnx-speaker-recognition": { capability: "speaker-id", profile: "speaker", localFirst: true, status: "acquired-runtime-evidence-pending" },
  "sherpa-onnx-audio-tagging": { capability: "audio-tagging", profile: "audio", localFirst: true, status: "acquired-review-evidence-pending" },
  "sherpa-onnx-pyannote-segmentation-3": { capability: "speaker-segmentation", profile: "segmentation", localFirst: true, status: "acquired-review-evidence-pending" },
  "sherpa-onnx-gtcrn-noise-suppression": { capability: "speech-enhancement", profile: "neural-denoising", localFirst: true, status: "runnable-release-verified" },
  "al-huda-kws": { capability: "wake-word", profile: "al-huda", localFirst: true, status: "runnable-release-verified" },
  "qwen3-forced-aligner-0.6b": { capability: "forced-alignment", profile: "timestamps", localFirst: true, status: "runnable-supported-languages-only", supportedLanguages: ["zh", "yue", "en", "de", "es", "fr", "it", "pt", "ru", "ko", "ja"] },
  "piper-en-us-libritts-high": { capability: "tts", profile: "english-fallback", localFirst: true, locale: "en-US", status: "runnable-release-verified", attributionRequired: true },
  "piper-ar-jo-kareem-medium": { capability: "tts", profile: "arabic-fallback", localFirst: true, locale: "ar-JO", status: "quarantine-license-review" },
  "nabra-82m-arabic-int8": { capability: "tts", profile: "arabic", localFirst: true, locale: "ar", status: "quarantine-license-review" },
  "f5-tts-v1-base": { capability: "tts", profile: "research", localFirst: true, status: "release-present-license-constrained-runtime-pending", usageRestriction: "non-commercial-only" },
  "whisper-cpp-ggml-base-multilingual": { capability: "asr", profile: "fallback", localFirst: true, status: "runnable-release-verified", multilingual: true },
  "pyannote-speaker-diarization-3.1": { capability: "diarization", profile: "multi-speaker", localFirst: true, status: "gated-quarantine" },
  "sherpa-onnx": { capability: "tts-runtime", profile: "runtime-library", localFirst: true, status: "runtime-framework-not-model" },
  "piper1-gpl": { capability: "tts-runtime", profile: "runtime-library", localFirst: true, status: "runtime-framework-not-model" }
});

export function listVoiceEngines() {
  return Object.entries(CATALOG).map(([id, value]) => ({ id, ...value }));
}

export function getVoiceEngine(id) {
  const key = String(id || "");
  const engine = CATALOG[key];
  if (!engine) throw new RangeError("Unknown Al-Huda voice engine: " + id);
  return Object.freeze({ id: key, ...engine });
}

export function selectVoiceEngine({ capability, lowPower = false, preferred = [] } = {}) {
  const preferredIds = Array.isArray(preferred) ? preferred : [];
  const candidates = listVoiceEngines().filter((item) => item.capability === capability);
  if (lowPower) {
    const lightweight = candidates.filter((item) => item.profile === "low-power");
    if (lightweight.length) return lightweight[0];
  }
  for (const id of preferredIds) {
    const match = candidates.find((item) => item.id === id);
    if (match) return match;
  }
  return candidates[0] || null;
}
