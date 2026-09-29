# Rechercher Ω — AI + Media runtime review — 2026-09-29

## Scope
This review covers the AI orchestration layer, conversation runtime, multimodal model fleet, media studio/runtime, execution adapters, resource admission, caching, observability, provenance and publication gates.

## Verified architecture
- Canonical scholarly Corpus remains outside generated-media and AI execution writes.
- Source evidence is passed to reasoning as explicitly untrusted data.
- AI-generated media is never treated as scholarly evidence.
- Local execution uses an executable allowlist and no implicit parent-process secret inheritance.
- MCP tool policy denies credential reads, secret search, arbitrary repository writes and raw external code execution.
- Execution jobs are deterministic/idempotent, bounded by attempts, cancellable and dead-letter capable.
- Telemetry excludes raw prompts, raw user queries, tool arguments and secrets by default.
- Resource admission can queue on concurrency/VRAM saturation.
- Semantic cache keys include model revision, evidence content hashes, rights/verification, generation configuration and language.
- Public media publication is fail-closed on rights, provenance, quality, safety or accessibility failure.
- Video outputs have measurable quality gates and scene-analysis support.
- Conversation state is bounded and volatile by default; persistent snapshots contain hashes/metadata rather than raw conversation content.

## Media capabilities now covered
Voice: microphone, WebRTC, noise suppression, VAD/barge-in, ASR, language identification, translation, multilingual TTS, live translation, captions, lip-sync/dubbing.

Studio: NLE editing, capture/live, audio production, raster/vector graphics, motion graphics, 3D/VFX, color management, timeline interchange, transcode/export, render queue, metadata probing.

Analysis/QA: OCR, video quality assessment, scene/shot detection, loudness normalization, frame signatures, subtitle timing checks, publication readiness.

## Runtime status model
A model can be:
1. Registered and license-reviewed.
2. Visible for planning/benchmarking.
3. Queued because runtime weights are not verified.
4. Execution-ready only when the applicable runtime artifact has immutable revision, SHA-256 and license verification.

This distinction is intentional and prevents a metadata-only model entry from being treated as an installed worker.

## Current model/weight blockers
- HunyuanVideo-1.5 and LTX-2 remain license/release gated.
- FLUX.1-schnell is access-gated on Hugging Face; the acquisition workflow now probes the actual weight file before streaming and records a blocked state on HTTP 401/403.
- Multimodal generation remains queued until a model/runtime pair has cleared weight status.

## Recommended runtime expansion path
- Promote verified lightweight local workers first.
- Maintain immutable weight manifests and release assets separately from Git and Corpus.
- Feed live GPU telemetry into resource admission.
- Use persistent NATS JetStream job state and an external cache backend when multi-run durability is required.
- Keep all public publication behind the combined rights/provenance/quality/safety/accessibility gate.

## Review outcome
The control-plane architecture is now materially stronger and fail-closed. The remaining gap is not the orchestration logic: it is verified runtime artifact availability/authorization for the selected generation workers. The system deliberately exposes that state instead of claiming generation is ready when it is not.
