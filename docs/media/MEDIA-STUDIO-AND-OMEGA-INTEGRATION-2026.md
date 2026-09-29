# Din Allah Media Studio Toolchain

This layer completes the production side around Rechercher Ω.

- PR #566 / Rechercher Ω: planning, model routing, multimodal generation, speech, document understanding and AI orchestration.
- PR #600 / Media Runtime: deterministic execution, editing, capture, audio, VFX, 3D, color, interchange, live media and transcoding.
- The two layers share task contracts and provenance rules; generated media never becomes scholarly evidence and never writes directly to Corpus.

## Production path

Capture -> ingest -> AI planning/generation -> NLE edit -> audio -> subtitles -> motion graphics -> VFX/compositing -> 3D -> color -> transcode/render -> QC -> live/export -> provenance.

## Release policy

Software tools are cached in the dedicated GitHub Release, while AI model weights stay in the separate model-weight release. Neither is stored inside Corpus.
