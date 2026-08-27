# Media Quality Pipeline — 2026

This layer provides a governed architecture for high-resolution image and video processing. It does not claim that a super-resolution engine is installed on GitHub-hosted infrastructure.

## Image quality

The preferred image restoration/super-resolution engine is Real-ESRGAN. The upstream project supports practical image restoration, tiled inference, 16-bit input, and arbitrary output scaling in its Python inference path. The upstream project is BSD-3-Clause licensed. https://github.com/xinntao/Real-ESRGAN

Profiles are explicit output targets, not promises of recovered detail: 4K = 3840-pixel long edge, 8K = 7680-pixel long edge, and 12K = 11520-pixel long edge. A future profile remains environment-dependent.

The pipeline retains the original, records source/output SHA-256, stores processing parameters and derived-artifact lineage, and requires verification before promotion. Model downloading from the network is disabled by default.

## Video quality

For video super-resolution, Video2X is the preferred orchestration candidate. Its current 6.0.0 release describes a C/C++ rewrite with upscaling and frame interpolation, and support for Real-ESRGAN, Real-CUGAN, RIFE and Anime4K through ncnn/Vulkan. https://github.com/K4YT3X/video2x

FFmpeg remains the transcode/container layer. FFmpeg is primarily LGPL 2.1+ but optional GPL components can change the licensing obligations of a build, so the selected build must be checked before distribution. https://ffmpeg.org/legal.html

## Live audio/video delivery

MediaMTX is a deployment candidate for live media routing. Its current project documents WebRTC, HLS/LL-HLS, SRT, RTSP, RTMP, MPEG-TS and RTP, plus recording and authentication. https://github.com/bluenviron/mediamtx

The repository must not claim that a Makkah or Madinah channel is available until a lawful source, publication rights, and a real deployment endpoint are verified.

## Download, 360° and 3D

Acquisition uses authorized direct retrieval with bounded retries and size limits. 360-degree video, 3D assets, animated images and future formats should enter through the same quarantine, integrity and lineage controls. A named download service or torrent client is not a trust boundary.

## Safety and scientific integrity

Media processing creates derived artifacts. It must never silently replace a trusted source image, video, audio file, document or Corpus record. Malware or integrity alerts block promotion. Automatic repair is restricted to reproducible, non-authoritative derived artifacts.

## 8K/12K reality

A higher output resolution does not create information that was never captured. Super-resolution reconstructs plausible detail. Actual processing capability depends on hardware, memory, codec, model, tile size, frame count and storage bandwidth. The orchestrator therefore probes the runtime rather than claiming that 8K/12K processing is always available.
