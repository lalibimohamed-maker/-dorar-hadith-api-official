# Media Quality Pipeline — 2026

This layer provides a governed architecture for high-resolution image and video processing. It does not claim that a super-resolution engine is installed on GitHub-hosted infrastructure.

## Image quality

The preferred image restoration/super-resolution engine is Real-ESRGAN. Its upstream project supports general image restoration, tiled inference, 16-bit images, and arbitrary output scaling in its Python inference path. The upstream project is BSD-3-Clause licensed. https://github.com/xinntao/Real-ESRGAN

Profiles are capability targets rather than promises of recovered detail:

- 4K: 3840-pixel long edge
- 8K: 7680-pixel long edge
- 12K: 11520-pixel long edge
- future: environment-dependent

An output profile records the requested target, engine, source hash, output hash, processing parameters, and lineage. The original is retained.

## Video quality

For video super-resolution, Video2X is the preferred orchestration candidate because it supports Real-ESRGAN, Real-CUGAN, RIFE and Anime4K through ncnn/Vulkan, and provides both upscaling and frame interpolation. https://github.com/K4YT3X/video2x

FFmpeg remains the media transcode/container layer. Its license must be respected for the selected build and optional GPL components. https://ffmpeg.org/legal.html

## Live audio/video delivery

MediaMTX is a candidate media router for deployments that need live delivery. It supports WebRTC, HLS/LL-HLS, SRT, RTSP, RTMP, MPEG-TS and RTP, plus recording and authentication. https://github.com/bluenviron/mediamtx

The repository must not claim a live Makkah or Madinah channel is available until a lawful source, publication rights and an actual deployment endpoint are verified.

## Download and ingestion

Use an authorized direct retrieval mechanism with bounded retries and size limits. A download is not redistribution permission. Torrent clients and third-party web download services are not trusted by default and are not core components.

## Safety and scholarly integrity

Media processing is downstream/derived work. It must never silently replace a trusted source image, video, audio file, document, or Corpus record. Any derived artifact is quarantined and scanned before publication. Malware or integrity alerts block promotion.

## Hardware and 8K/12K reality

8K and 12K are output targets, not evidence that a low-resolution source contains missing information. Super-resolution reconstructs plausible detail; it cannot guarantee recovery of information never captured. Actual processing capacity depends on GPU/CPU, VRAM/RAM, codec, tile size, model, frame count, thermal limits, and storage bandwidth.

The orchestrator therefore measures capabilities at runtime instead of claiming that 12K is always available.
