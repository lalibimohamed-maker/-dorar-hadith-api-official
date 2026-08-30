# Media Engine Mesh — 2026

## Purpose

This document defines the unified processing mesh for the encyclopedia's high-resolution media. The mesh combines restoration, spatial super-resolution, temporal consistency, optional frame interpolation, color/HDR preservation, target-resolution rendering, objective evaluation, provenance, checksums and adaptive delivery.

## Open-ended quality principle

The archival master has no application-imposed resolution ceiling. 4K, 8K, 12K, 16K, 24K and future higher resolutions are targets or preserved native formats, not a hard ladder ceiling.

A quality label never proves native detail. Native source geometry must be recorded. Any reconstructed/upscaled output must remain marked as derived.

## Engine mesh

### Image restoration and super-resolution

- Real-ESRGAN: restoration and practical super-resolution.
- SwinIR: restoration and super-resolution candidate.
- HAT: high-quality image super-resolution candidate.

### Video restoration and super-resolution

- BasicVSR++: temporal propagation and video super-resolution.
- Video2X: orchestration and upscaling pipeline.
- SeedVR2: one-step diffusion video restoration for high-resolution processing.
- FlashVSR: streaming diffusion video super-resolution.
- PS-SR: speculative-diffusion video super-resolution.
- AVSR-Diff: arbitrary-scale video super-resolution with temporal consistency.
- Real-CUGAN: super-resolution backend candidate.
- Anime4K: real-time upscaling candidate.

### Temporal processing

- RIFE: optional frame interpolation. Interpolation is never used to claim higher native capture quality.

### Codec and container

- FFmpeg: decode, encode, mux and demux layer. The exact build and enabled components must be license-audited before redistribution.

## Orchestration rule

Engines are not blindly chained. The selector chooses stages based on measured input defects, source characteristics, target resolution, temporal requirements, available hardware, memory and verified engine/model capability. A/B evaluation can compare candidate pipelines while the original and all audit-relevant derived artifacts remain preserved.

The preferred order is:

`quarantine → integrity → rights/provenance → metadata → restoration → spatial SR → temporal consistency → optional interpolation → color/HDR preservation → target render → objective evaluation → checksum/lineage → delivery`

## Objective quality and truth controls

Every promoted derivative should record source dimensions, derivative dimensions, frame rate, aspect ratio, bit depth, chroma format, color primaries, transfer function, HDR metadata, codec/profile, processing parameters, engine/model versions, source checksum and output checksum.

A lower-resolution source may be reconstructed at 24K for presentation, but it must never be labelled as a native 24K capture. The native/derived distinction is part of the artifact metadata.

## 24K and beyond

24K is treated as an open target class rather than one universal pixel geometry. The exact dimensions and aspect ratio come from the actual source or from a documented target geometry. Future 32K, 48K or higher targets may be added without changing the master policy.

## Display chain

The processing mesh is display-agnostic. It can produce derivatives for large displays, projectors, tiled/multi-projector walls and consumer TVs.

LG NanoCell is represented as a display-compatibility profile, not as a processing engine. LG describes NanoCell as using approximately 1 nm nanoparticles to filter dull colors and improve RGB color purity, and its NanoCell pages pair the technology with wide viewing-angle color accuracy and 8K models. NanoCell therefore belongs after the media color/HDR pipeline, at the display stage; it does not create 24K pixels in the media file.

For a physical 24K presentation, the complete display chain must actually resolve the required native pixel detail or use a documented tiled/multi-projector architecture. Accepting a high-resolution signal alone is not proof of native 24K display resolution.

## Automatic future discovery

The registry may discover new engines from official upstream repositories, research releases and model releases. Discovery alone does not install or enable an engine.

Promotion requires identity, license review, reproducible installation, model availability, runtime detection, hardware/VRAM profile, resolution capability, temporal-stability testing, perceptual/fidelity benchmarking, color/HDR preservation checks and checksum/lineage verification.

Promotion states are:

`discovered → audited → benchmarking → approved → enabled`

Unknown or unverifiable engines remain disabled.

## Free-first rule

The mesh does not require a paid API or subscription for its policy, orchestration metadata or validation. Local/open-source engines are preferred where licensing and runtime evidence permit. External platform integrations remain optional adapters and may never replace the preserved internal master.
