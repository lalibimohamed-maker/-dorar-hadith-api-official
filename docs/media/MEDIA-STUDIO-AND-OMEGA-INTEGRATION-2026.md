# Din Allah Media Studio Toolchain

This layer completes the production side around Rechercher Ω.

- PR #566 / Rechercher Ω: planning, model routing, multimodal generation, speech, document understanding and AI orchestration.
- PR #604 / Media Runtime (stacked on #566): deterministic execution, editing, capture, audio, VFX, 3D, color, interchange, live media and transcoding.
- The two layers share task contracts and provenance rules; generated media never becomes scholarly evidence and never writes directly to Corpus.

## Production path

Capture -> ingest -> AI planning/generation -> NLE edit -> audio -> subtitles -> motion graphics -> VFX/compositing -> 3D -> color -> transcode/render -> QC -> live/export -> provenance.

## Release policy

Software tools are cached in the dedicated GitHub Release, while AI model weights stay in the separate model-weight release. Neither is stored inside Corpus.

## Operational release boundary

The studio tool release is built by `.github/workflows/media-studio-tool-release.yml` and is kept separate from the AI model-weight release. The headless runtime consumes only declared release-backed assets; desktop applications remain a separate production layer.
