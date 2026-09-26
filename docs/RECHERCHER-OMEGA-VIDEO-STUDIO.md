# Rechercher Ω — Video Studio

The Video Studio converts a council-reviewed research case and script into a deterministic, scene-level production plan.

## Boundary

- Source records and evidence IDs remain the factual layer.
- Generated images/video are presentation assets, never scholarly evidence.
- No generated asset may write directly to Corpus.
- Rights and provenance gates are mandatory.
- Weight/license clearance remains separate from runtime availability.
- Paid fallback remains disabled.

## Scene contract

Every scene carries:

- `scene_id`
- ordered duration
- narration
- `evidence_ids`
- visual mode
- generation task
- prompt and optional negative prompt
- source assets
- model/runtime preferences
- provenance flags

A scene may use a generated visual, but its factual grounding remains the explicit `evidence_ids` list.

## Execution flow

`research case -> council-reviewed script -> Video Studio scene plan -> model/runtime router -> generation/editing -> subtitles/voice -> deterministic composition -> rights/provenance gate -> publication review`

The planner does not silently invoke a model, download weights, call a paid provider, or write to Corpus.

## Video-generation fleet

The existing multimodal fleet includes HunyuanVideo-1.5, LTX-2, CogVideoX and Wan 2.2 for video tasks, with Whisper/CosyVoice for speech and Flux/PaddleOCR/Qwen-VL for supporting visual/document work. Each model remains `review_required` until its repository and weight licenses are explicitly cleared.

HunyuanVideo-1.5 is especially suitable as an executable T2V/I2V path because its official repository publishes inference code, checkpoints and ComfyUI/Diffusers integration; its documented minimum GPU memory with offloading is 14 GB. License status remains a project gate rather than an assumption.
