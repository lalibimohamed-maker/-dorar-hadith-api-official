# Din Allah Media Engine — External GPU Evaluation

This directory defines a reproducible external GPU experiment. It deliberately does **not** download model weights or generate video inside ordinary pull-request CI.

## Target experiment

Primary first candidate: **Wan2.2 TI2V-5B**.

The official Wan2.2 project documents TI2V-5B as a text/image-to-video model supporting 720p at 24 FPS and describes consumer-GPU operation for suitable hardware. See: https://github.com/Wan-Video/Wan2.2

## Procedure

1. Start a clean GPU notebook/runtime (Kaggle or Colab are acceptable for an experiment; availability and quotas vary).
2. Clone the exact upstream Wan2.2 revision selected for the run.
3. Install the upstream dependencies in the external runtime only.
4. Obtain the exact checkpoint from its official distribution endpoint and record its revision/hash.
5. Use **one prompt from `prompt-suite.json` at a time**. Do not add Quranic text or religious claims to the generation prompt.
6. Generate a short 16:9 clip at the highest stable setting supported by the available GPU.
7. Record: model, checkpoint, upstream revision, runtime, GPU type, VRAM, seed, sampler/settings, prompt ID, prompt SHA-256, generation timestamp, and the exact terms URL.
8. Run `ffprobe` and retain the complete JSON metadata outside Git.
9. Verify input/reference rights. Generated video remains **illustration**, not evidence.
10. Run VBench-2.0 against the produced clip where the selected dimension supports custom-video evaluation.
11. Copy only the compact scorecard/metadata into the repository or PR; do **not** commit large video files or model weights.

## VBench-2.0

Official documentation: https://github.com/Vchitect/VBench/tree/master/VBench-2.0

VBench-2.0 supports customized-video evaluation for selected dimensions and also supports standard prompt-suite evaluation. Use the official implementation and record the exact version/commit used for the run.

## Reproducibility gate

A result is not accepted as a benchmark record when any mandatory field is missing. In particular, missing checkpoint identity, provenance, rights status, or prompt identity blocks promotion.

## Quality gate

Do not promote a candidate on one score alone. Compare the same prompt suite across candidates and keep the raw output metrics. Human review remains required for final editorial quality, scientific presentation, unintended artifacts, and religious-content handling.
