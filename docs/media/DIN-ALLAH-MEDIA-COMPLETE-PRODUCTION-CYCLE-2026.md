# Din Allah Media — Complete Production Cycle

This contract turns the existing Media Engine foundation into a complete, governed production lifecycle for the Din Allah Encyclopedia.

## What is now covered

**intake → research → evidence → claim verification → script → storyboard → asset planning → licensed media discovery → rights gate → ingest → malware/integrity scan → original generation → scientific graphics → voice/recitation → transcription/alignment → translation/localization → semantic composition → timeline edit → captions/accessibility → audio mastering → visual QC → scientific/religious fidelity → provenance → deterministic render → delivery variants → publication gate → publish → archive → rollback/rebuild**

The scholarly Corpus remains a separate authoritative layer. Media is a derived presentation layer and never silently writes back into the Corpus.

## Free-first architecture

The production contract has no paid core dependency. The default toolchain is built around free/open-source components such as FFmpeg, OpenTimelineIO, Blender, Kdenlive, Audacity, PySceneDetect and Whisper. Optional AI generation, TTS, super-resolution or hosted services are adapters; they cannot be required for the encyclopedia to remain operational.

A tool/model is not considered production-ready merely because its source code is open. The exact release, checkpoint/weights, dataset terms and intended usage must pass the rights/license gate.

## Evidence and Islamic-content integrity

Every factual claim enters the media plan through an evidence packet. Quran Arabic is copied only from a verified canonical source and is rendered verbatim. Translations are separate meaning assets. Quran recitation is a separate rights-cleared asset. Hadith scenes retain collection/reference/grading metadata.

No generative model may invent Quran Arabic, Quran recitation, hadith wording, scholarly attribution or scientific citations.

## Asset lineage

Every embedded asset receives a provenance record containing source, creator, license evidence, retrieval time, SHA-256, usage scope, attribution, tool/model versions and parent assets. Derived assets never overwrite their inputs.

## Quality and publication

Publication is fail-closed. Missing evidence, rights, provenance, integrity, audio, visual quality, accessibility, Quran integrity, human review or CI blocks publication.

The repository stores configuration, code, tests and manifests—not generated video files. Large media belongs in governed artifact/storage layers with checksums and resumable delivery.

## Reproducibility and recovery

Each stage is checkpointed. A failed render can resume from the last verified stage. Derived artifacts can be rebuilt without changing authoritative scholarly data. Published media can be rolled back while preserving its manifest and history.

## Implementation status

This change adds the complete lifecycle contract and deterministic gate evaluator. It does **not** claim that every optional model, GPU backend, storage service or external provider is installed. Runtime adapters can be activated only after capability, license, security and quality evidence is present.
