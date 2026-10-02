# Al-Huda voice runtime completion contract

## Canonical identity

- Assistant name: **Al-Huda**
- Arabic name: **الهُدَى**
- Wake Word: **الهُدَى**

## Closure rule

A configuration entry is not runtime proof. A model release is not runtime proof. A unit test with fake engines is not device proof.

A capability reaches **runtime-verified** only when its actual implementation is loaded and executed and produces the expected output. Native iOS/Android capabilities additionally require evidence from the target platform.

## Layers

1. Mobile Runtime Bridge
2. Permission and lifecycle manager
3. Model Lifecycle Manager
4. Battery/thermal voice governor
5. Audio Front-End
6. VAD / endpointing / turn detection
7. Barge-in / interruption cancellation
8. Question input via Qwen3-ASR
9. Al-Huda / Al-Taqwa reasoning
10. TTS output
11. Optional Speaker ID, diarization and audio-event detection
12. Native iOS / Android invocation
13. WebAssembly browser runtime

The bridge and lifecycle contracts may be tested in CI, but they do not close native/device gaps by themselves.
