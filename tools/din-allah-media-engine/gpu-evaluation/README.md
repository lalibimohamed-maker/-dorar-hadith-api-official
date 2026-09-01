# Din Allah Media Engine — External GPU Evaluation

This directory defines a reproducible external GPU experiment. It deliberately does **not** download model weights or generate video inside ordinary pull-request CI.

## Target experiment

Primary first candidate: **Wan2.2 TI2V-5B**.

The official Wan2.2 project documents TI2V-5B as a text/image-to-video model supporting 720p at 24 FPS. Record the exact upstream revision and model revision used for every run. citeturn899813search0turn177801search5

## Resource reality check

The current Hugging Face repository listing is about **34.2 GB**. A free notebook may not have enough disk space even when the GPU itself is suitable. The run script therefore checks free disk space before downloading the checkpoint and fails closed instead of starting a doomed transfer. citeturn899813search1

The official single-GPU recipe requires about **24 GB VRAM** for the documented 720p TI2V-5B path. A runtime with only 16 GB per GPU should not be treated as equivalent merely because it has multiple GPUs; use the official multi-GPU/FSDP path only after a separate validated configuration. citeturn177801search7turn177801search6

## Low-resource Apple Silicon smoke path

When an Apple Silicon Mac is available, use `run-wan21-1.3b-mlx.sh` as a **smoke/evaluation path**, not as the quality winner. The upstream MLX-Video project supports Wan2.1/Wan2.2 on Apple Silicon, and its repository is MIT-licensed. The separate Wan2.1-T2V-1.3B checkpoint is Apache-2.0. citeturn346file0turn343file0turn378792search0turn378792search2

This path is useful for validating the complete media contract on a local Apple Silicon machine without requiring the much larger TI2V-5B checkpoint. Its output must still pass the same `ffprobe`, hash, provenance, rights, and benchmark gates.

Example:

```bash
PROMPT_ID=ant-macro-01 SEED=42 \
  bash tools/din-allah-media-engine/gpu-evaluation/run-wan21-1.3b-mlx.sh
```

## Procedure

1. Start a clean GPU notebook/runtime (Kaggle or Colab are acceptable for an experiment; availability and quotas vary).
2. For the primary run, execute `run-wan22-ti2v5b-kaggle.sh`. The script keeps model weights and generated media outside Git, records revisions/hashes, generates one fixed prompt, runs `ffprobe`, and writes run metadata.
3. Use **one prompt from `prompt-suite.json` at a time**. Do not add Quranic text or religious claims to the generation prompt.
4. Generate a short 16:9 clip. For TI2V-5B, the upstream configuration uses `1280*704` for 720P. `FRAME_NUM=121` targets roughly 5 seconds at 24 FPS. Record the exact generation settings and seed. citeturn177801search0turn177801search5
5. Record: model, checkpoint, upstream revision, runtime, GPU type, VRAM, seed, generation settings, prompt ID, prompt SHA-256, generation timestamp, and exact terms URL.
6. Run `ffprobe` and retain the complete JSON metadata outside Git. Keep model weights and the generated video outside the repository.
7. Verify input/reference rights. Generated video remains **illustration**, not evidence.
8. For general animal/nature video, use the original VBench dimensions that officially support custom videos: `subject_consistency`, `background_consistency`, `motion_smoothness`, `dynamic_degree`, `aesthetic_quality`, and `imaging_quality`. citeturn299460search1turn299460search4
9. Generate the exact VBench custom prompt mapping with `make-vbench-prompt-file.mjs`, then pass that mapping to `run-vbench-custom.sh`.
10. Use VBench-2.0 only when the selected dimension is explicitly supported for custom input and the media satisfies that dimension's requirements. `Diversity` requires at least 20 videos for one prompt; `Multi-View_Consistency` requires the corresponding multi-view setup. citeturn299460search0
11. Copy only the compact scorecard/metadata into the repository or PR; do **not** commit large video files or model weights.

### Example

```bash
PROMPT_ID=ant-macro-01 SEED=42 FRAME_NUM=121 \
  bash tools/din-allah-media-engine/gpu-evaluation/run-wan22-ti2v5b-kaggle.sh

node tools/din-allah-media-engine/gpu-evaluation/make-vbench-prompt-file.mjs \
  tools/din-allah-media-engine/gpu-evaluation/prompt-suite.json \
  ant-macro-01 ant-macro-01.mp4 /tmp/ant-macro-vbench.json

bash tools/din-allah-media-engine/gpu-evaluation/run-vbench-custom.sh \
  "$PWD/din-allah-media-run/ant-macro-01/ant-macro-01.mp4" \
  /tmp/ant-macro-vbench.json \
  ./vbench-results
```

The generation script writes `din-allah-media-run/<prompt-id>/` with the generated clip, `ffprobe.json`, `video.sha256`, model file hashes, and `run-metadata.json`. Do not upload the clip itself to Git unless a separate storage policy explicitly allows it.

## Benchmark policy

Benchmark adapters are intentionally kept separate from the generation runner. A benchmark command must be validated against the benchmark's official custom-input contract before it is added to this directory.

The original VBench custom-input interface accepts a JSON dictionary in the form `{ "video_path": "prompt" }`, and the supported custom-video dimensions listed above are explicitly documented by the upstream project. citeturn299460search1turn299460search4

The VBench-2.0 launcher is deliberately guarded: it rejects unsupported custom-input dimensions instead of guessing. Its official documentation currently lists a different set of specialized dimensions, so those are not used for the ant/nature path unless the media actually satisfies their requirements. citeturn299460search0

## Reproducibility gate

A result is not accepted as a benchmark record when any mandatory field is missing. In particular, missing checkpoint identity, provenance, rights status, or prompt identity blocks promotion.

## Quality gate

Do not promote a candidate on one score alone. Compare the same prompt suite across candidates and keep the raw output metrics. Human review remains required for final editorial quality, scientific presentation, unintended artifacts, and religious-content handling.
