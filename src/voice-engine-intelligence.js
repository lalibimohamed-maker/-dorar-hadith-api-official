const CATALOG = Object.freeze({
  "qwen3-asr-0.6b": { capability: "asr", profile: "low-power", localFirst: true },
  "qwen3-asr-1.7b": { capability: "asr", profile: "quality", localFirst: true },
  "silero-vad": { capability: "vad", profile: "endpointing", localFirst: true },
  "sherpa-onnx-punctuation": { capability: "punctuation", profile: "post-asr", localFirst: true },
  "sherpa-onnx-speaker-recognition": { capability: "speaker-id", profile: "speaker", localFirst: true },
  "sherpa-onnx-audio-tagging": { capability: "audio-tagging", profile: "audio", localFirst: true },
  "al-huda-kws": { capability: "wake-word", profile: "al-huda", localFirst: true },
  "sherpa-onnx": { capability: "tts", profile: "local", localFirst: true },
  "piper1-gpl": { capability: "tts", profile: "local", localFirst: true }
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
