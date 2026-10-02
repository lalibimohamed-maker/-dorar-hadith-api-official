const RELEASES = Object.freeze({
  "rechercher-voice-runtime-2026-10": Object.freeze({
    "qwen3-asr-0.6b": Object.freeze({
      assets:["Qwen3-ASR-0.6B.tar.bz2"],
      digests:["sha256:d6868f6c206744e6bacca4208b58098e813aba5eda087ebde2c9eb232c6401da"],
      runtimeVerified:true,
    }),
    "qwen3-asr-1.7b": Object.freeze({
      assets:["Qwen3-ASR-1.7B.tar.bz2.part-aa","Qwen3-ASR-1.7B.tar.bz2.part-ab","Qwen3-ASR-1.7B.parts.SHA256SUMS.txt"],
      digests:[
        "sha256:d4e95a75c00c701d9e2655cc653f6419cebe95724dbd827b941a1093a003b7fc",
        "sha256:bfb220f3fb617ea59e0392efe966719d15a6eb3923dfa9e5c3e5cc313ef0b816",
        "sha256:5ac0d28d507184b3a1ac051988e3af4370bf9243c2fed7e6cf43584eb3ae092f",
      ],
      runtimeVerified:true,
    }),
    "sherpa-onnx-vad-silero": Object.freeze({
      assets:["silero_vad.onnx"],
      digests:["sha256:9e2449e1087496d8d4caba907f23e0bd3f78d91fa552479bb9c23ac09cbb1fd6"],
      runtimeVerified:true,
    }),

  }),
  "rechercher-voice-gap-2026-10": Object.freeze({
    "qwen3-forced-aligner-0.6b": Object.freeze({
      assets:["Qwen3-ForcedAligner-0.6B.tar.bz2"],
      digests:["sha256:0f5986ecad5a7cac422413cfc5ca0a7ccfa7bb89958bed54ab4b21f86a27828d"],
      runtimeVerified:true,
    }),
  }),
  "rechercher-voice-optional-2026-10": Object.freeze({
    "piper-en-us-libritts-high": Object.freeze({
      assets:["piper-en-us-libritts-high.tar.bz2"],
      digests:["sha256:e89235985e08ddab4bd027c2e0173e88a00e88521bc860b3931c4d5d8657ec22"],
      runtimeVerified:true,
    }),
    "f5-tts-v1-base": Object.freeze({
      assets:["F5TTS_v1_Base.tar.bz2"],
      digests:["sha256:ed17deb61f560d389185042bd9e633243e5a8253adffab281046c1cd9a2e6e3c"],
      runtimeVerified:false,
    }),
  }),
});

export function resolveVoiceReleaseRef({ releaseTag = "rechercher-voice-runtime-2026-10", modelId } = {}) {
  const release=RELEASES[releaseTag];
  if (!release) throw new Error("unknown voice release");
  const entry=release[modelId];
  if (!entry) throw new Error("voice model is not published in the release");
  return Object.freeze({
    releaseTag,
    modelId,
    assets:[...entry.assets],
    digests:[...entry.digests],
    runtimeVerified:entry.runtimeVerified === true,
  });
}

export function isReleaseRuntimeVerified(reference = {}) {
  return reference.runtimeVerified === true && Array.isArray(reference.assets) &&
    reference.assets.length > 0 && Array.isArray(reference.digests) &&
    reference.digests.length > 0;
}
