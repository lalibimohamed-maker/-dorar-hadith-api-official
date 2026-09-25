# Rechercher Ω — Open Multimodal Evidence Intelligence

## Purpose

Rechercher Ω is the orchestration layer above Rechercher's source, corpus, acquisition and API systems. It is intentionally **not** a new foundation model.

It coordinates specialized open models for reasoning, document understanding, multimodal perception, speech and video generation while preserving the project's source/provenance/rights boundaries.

## Architecture

Source Registry (#561/#563)
→ discovery/acquisition
→ evidence records
→ document understanding/OCR
→ reasoning/planning
→ model router
→ generation/editing
→ adversarial QA
→ provenance
→ rights gate
→ publication.

### Core principle

> A generated artifact is an output, never scholarly evidence.

The Corpus remains curated. Ω may propose, transform, summarize, visualize or generate media from evidence, but it cannot promote generated content directly into the scholarly Corpus.

## Model families

- Qwen3: reasoning/planning/tool use.
- Qwen3-Omni: text/image/audio/video understanding and speech.
- PaddleOCR: document parsing/OCR/layout.
- Wan2.2: video generation/animation.
- HunyuanVideo-1.5: text/image-to-video.
- LTX-2: synchronized audio-video generation.
- CogVideoX: alternative video generation/continuation.
- CosyVoice: speech generation.
- SGLang: serving/runtime.

Model entries are candidates. **Code license and model-weight license are tracked separately and must be reviewed before public redistribution or commercial use.**

## Adversarial council

A future execution layer should run independent roles:

1. Researcher — retrieves candidate evidence.
2. Source Auditor — checks origin/edition/identity.
3. Contrarian — searches for conflicting evidence.
4. Logic Auditor — checks whether conclusions follow from evidence.
5. Media Critic — checks visual/audio consistency against the source.
6. Rights Auditor — checks publication rights.
7. Synthesizer — produces the final answer/artifact only after gates pass.

This is deliberately implemented as a policy contract first, not as a claim that one LLM can guarantee truth.

## Model tournament

Ω can benchmark multiple workers on the same task and retain reproducible measurements:

- task success
- evidence fidelity
- prompt adherence
- temporal consistency
- Arabic text fidelity
- latency
- peak VRAM
- output size
- rights/license state.

The router should select by measured capability and constraints, not by popularity.

## Reproducibility

Every generated artifact should retain:

- source IDs
- edition identifiers where applicable
- input SHA-256
- model IDs and versions
- prompt/config hash
- output SHA-256
- rights state
- QA state.

## Free-first execution

Ω is designed to run locally or on available free GPU environments. GitHub Actions should orchestrate manifests/tests and not be treated as a free video-GPU service.

No paid API is required by the architecture.

## Security and scholarly boundaries

- Never store secrets in the registry.
- Never treat a model output as primary source evidence.
- Never write generated media directly into Corpus.
- Public redistribution requires rights clearance.
- Unknown rights remain research-only.
- Model licenses must be checked independently from repository licenses.

## Roadmap

### Phase 1 — foundation
- registry
- router contract
- provenance contract
- rights/corpus gates
- deterministic tests

### Phase 2 — workers
- local Qwen3/Qwen3-Omni adapter
- PaddleOCR adapter
- video adapters
- speech adapter
- SGLang runtime adapter

### Phase 3 — council
- independent critics
- conflict graph
- evidence scoring
- retry/escalation

### Phase 4 — tournament
- benchmark harness
- resource measurements
- routing policy learned from benchmark records

### Phase 5 — multimodal publishing
- multilingual media manifests
- subtitle/audio generation
- deterministic post-processing
- rights-aware release promotion
