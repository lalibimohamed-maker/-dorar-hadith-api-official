# Global Video Resolution Orchestrator — 2026

The encyclopedia treats high-resolution video as a cooperative pipeline, not as a chain that blindly runs every model.

## Goals

- Preserve source provenance and rights.
- Preserve temporal consistency between frames.
- Restore degraded footage before aggressive enlargement.
- Produce separate archive, projector, and mobile delivery variants.
- Permit 8K, 12K, 16K and 24K output targets when the source, model, hardware, and quality gate justify them.
- Never describe generated detail as original source detail.

## Engine roles

- BasicVSR++: temporal video super-resolution and propagation/alignment.
- RealBasicVSR: real-world video restoration for degraded footage.
- Real-ESRGAN: selective frame-level restoration fallback.
- SwinIR: selective frame restoration/quality validation.
- HAT: high-detail frame validation path, subject to current model/checkpoint terms.
- Thera: arbitrary-scale delivery stage after temporal restoration, subject to current model/checkpoint validation.

BasicVSR++ and RealBasicVSR are maintained as complementary video-oriented paths. Their research repositories document video super-resolution/restoration workflows and Apache-2.0 licensing. RealBasicVSR is specifically aimed at real-world video restoration. Source repositories: https://github.com/ckkelvinchan/BasicVSR_PlusPlus and https://github.com/ckkelvinchan/RealBasicVSR.

## Cooperative routing

The orchestrator measures source resolution, frame rate, codec, compression, blur, noise, motion, scene changes, text density, faces, device memory, and GPU availability.

It then selects:

`temporal model -> restoration if needed -> arbitrary-scale stage -> temporal/spatial quality checks -> delivery encode`

A second or third model is invoked only when diagnostics show a documented reason. Running all models on every frame is prohibited by default because it wastes compute and can introduce inconsistent detail.

## 24K policy

`24K` is an output target, not a claim of native 24K source information. The UI must retain and expose the original dimensions, target dimensions, scale factor, engine/model versions, processing passes, and provenance hash.

For historical, scientific, educational, religious, or archival videos, restoration must never silently create or alter factual details that could change the meaning of the source.

## Delivery variants

- **Mobile:** conservative bitrate, memory-aware tiles/processing, fast decode path.
- **Projector:** higher bitrate, suitable color/bit-depth profile, stable frame pacing.
- **Archive:** highest supported quality, separate master, checksums and processing manifest.

The archive master is never silently replaced by a delivery encode.

## Quality gate

Reject output with severe flicker, temporal instability, duplicated/dropped frames, corruption, missing provenance, unknown model licensing, or unacceptable degradation of text/faces/edges.

Flag extreme scale and heavy synthetic detail for human review.

## Rights

A free/open-source engine does not make source videos, recordings, books, images, or trained model weights free to redistribute. Every external asset and every model checkpoint must pass the project's rights gate independently.
