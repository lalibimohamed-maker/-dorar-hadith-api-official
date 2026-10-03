export const VOICE_CAPABILITIES = Object.freeze({
  wakeWord: 'arabic-kws-required',
  speechToText: 'qwen3-asr',
  languageIdentification: 'qwen3-asr',
  vad: 'silero-vad',
  punctuation: 'sherpa-onnx-punctuation',
  speakerIdentification: 'sherpa-onnx',
  diarization: 'sherpa-onnx',
  audioEventDetection: 'sherpa-onnx',
  endpointing: 'local-runtime',
  bargeIn: 'local-runtime',
  audioFrontEnd: 'platform-audio-stack'
});
