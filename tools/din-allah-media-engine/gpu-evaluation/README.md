# Din Allah Media Engine — External GPU Evaluation

This directory defines a reproducible external GPU experiment. It deliberately does **not** download model weights or generate video inside ordinary pull-request CI.

## Target experiment

Primary first candidate: **Wan2.2 TI2V-5B**.

The official Wan2.2 project documents TI2V-5B as a text/image-to-video model supporting 720p at 24 FPS and describes consumer-GPU operation for suitable hardware. See: https://github.com/Wan-Video/Wan2.2

## Procedure

1. Start a clean GPU notebook/runtime (Kaggle or Colab are acceptable for an experiment; availability and quotas vary).
2. Run `run-wan22-ti2v5b-kaggle.sh` from the repository root. The script clones the upstream repository, downloads the exact model repository outside Git, records the upstream/model revisions and hashes, generates one fixed prompt, runs `ffprobe`, and writes run metadata.
3. Use **one prompt from `prompt-suite.json` at a time**. Do not add Quranic text or religious claims to the generation prompt.
4. Generate a short 16:9 clip at the highest stable setting supported by the available GPU. For TI2V-5B the upstream documentation uses `1280*704` for 720P. Record the exact generation settings and seed.
5. Record: model, checkpoint, upstream revision, runtime, GPU type, VRAM, seed, sampler/settings, prompt ID, prompt SHA-256, generation timestamp, and the exact terms URL.
6. Run `ffprobe` and retain the complete JSON metadata outside Git. Keep model weights and the generated video outside the repository.
7. Verify input/reference rights. Generated video remains **illustration**, not evidence.
8. Run VBench-2.0 against the produced clip where the selected dimension supports custom-video evaluation.
9. Copy only the compact scorecard/metadata into the repository or PR; do **not** commit large video files or model weights.

### Example

```bash
PROMPT_ID=ant-macro-01 SEED=42 \\
  bash tools/din-allah-media-engine/gpu-evaluation/run-wan22-ti2v5b-kaggle.sh
```

The script writes `din-allah-media-run/<prompt-id>/` with the generated clip, `ffprobe.json`, `video.sha256`, model file hashes, and `run-metadata.json`. Do not upload the clip itself to Git unless a separate storage policy explicitly allows it.

## VBench-2.0

Official documentation: https://github.com/Vchitect/VBench/tree/master/VBench-2.0

VBench-2.0 supports customized-video evaluation for selected dimensions and also supports standard prompt-suite evaluation. Use the official implementation and record the exact version/commit used for the run.

## Reproducibility gate

A result is not accepted as a benchmark record when any mandatory field is missing. In particular, missing checkpoint identity, provenance, rights status, or prompt identity blocks promotion.

## Quality gate

Do not promote a candidate on one score alone. Compare the same prompt suite across candidates and keep the raw output metrics. Human review remains required for final editorial quality, scientific presentation, unintended artifacts, and religious-content handling.
