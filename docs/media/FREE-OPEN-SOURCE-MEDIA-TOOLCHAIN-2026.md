# Free/Open-Source Media Toolchain — 2026

## Goal

Provide a sustainable media stack for the Din Allah Encyclopedia without depending on paid SaaS or silently downloading arbitrary software.

## Selected open-source candidates

- **Real-ESRGAN** — image restoration and super-resolution. Current upstream license evidence: BSD-3-Clause. The tool supports arbitrary output scaling and tiled inference.
- **Video2X** — video upscaling/frame interpolation orchestrator. Its exact dependency/backend licenses must be checked at each release before adoption.
- **FFmpeg** — media decoding, encoding, filtering and container conversion. The project and its build options can involve LGPL/GPL components; the exact build configuration must be recorded before redistribution.
- **Tesseract** — OCR/document extraction. Apache-2.0; dependencies have their own licenses.
- **PaddleOCR** — modern document OCR/structure pipelines. Apache-2.0 for the project; model/data terms must be checked separately.
- **COLMAP** — multi-view 3D reconstruction. New BSD for COLMAP itself; third-party dependency terms remain separate.
- **Open3D** — 3D data processing, geometry and visualization. MIT.
- **MediaMTX** — live media routing. MIT.

## What “free for life” means here

The encyclopedia will prefer software that is free/open-source under a license permitting the intended use. It cannot promise that every future upstream release will remain under the same license. Therefore every upgrade is re-checked for license, security, provenance, compatibility and resource requirements.

## Installation model

The repository does **not** vendor large model binaries or execute arbitrary installers from the network. A deployment environment may use the governed bootstrap process to install approved packages from its package manager or pinned upstream source. The bootstrap must run security checks first and must be reproducible.

Models are never auto-downloaded merely because a new project is discovered. Model licenses and checksums must be established before use.

## Resolution and immersion

The pipeline defines 4K, 8K and 12K output profiles. It also tracks 360-degree media, 3DoF/3DoF+/6DoF and volumetric/3D assets. “7D” is not treated as a standard technical capability; any future product using that marketing term must be mapped to concrete, testable capabilities.

## Interoperability graph

`source → integrity → decode → enhance → transcode → metadata/lineage → 2D/3D/360 viewer → live/deliverable output`

Supported interchange families should remain open and explicit: glTF for web-oriented 3D delivery, OpenUSD for richer scene interchange, and standard image/video/audio containers and codecs supported by the selected FFmpeg/MediaMTX configuration.

## Safety boundary

No media tool may:

1. overwrite a trusted source silently;
2. convert derived OCR or AI-enhanced pixels into authoritative scholarly text;
3. change protected `main` outside a reviewed PR;
4. delete trusted Corpus material automatically;
5. install an unknown binary without provenance and security verification.
