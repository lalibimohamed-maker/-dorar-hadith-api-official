# Din Allah Encyclopedia — Performance & Resilience Standard 2026

## Goal
Keep the encyclopedia fast, responsive, resilient, and continuously improvable without introducing paid dependencies or weakening scholarly/security controls.

## Principles
1. Prefer local, open-source, repository-native or GitHub-native capabilities before external paid services.
2. Every latency-sensitive or availability-sensitive component must have a measured baseline.
3. Prefer caching, batching, indexing, streaming, and bounded concurrency before adding infrastructure.
4. Every optional external engine must have a free fallback where a technically suitable fallback exists.
5. Fallback selection is automatic only for health/availability and technical compatibility; scholarly promotion always remains gated by provenance, rights, and verification.
6. Optimizations must not alter canonical scholarly text, source attribution, rights state, or evidence state.
7. Performance regressions must become observable failures or review findings rather than silent degradation.

## Required layers

### API and search
- bounded concurrency
- deterministic pagination
- cacheable read paths
- query normalization and safe result reuse
- source-aware timeouts and graceful degradation

### Content and source refresh
- incremental refresh instead of full re-ingestion when possible
- deduplication before indexing
- content hashing and change detection
- quarantine before promotion
- auditable rollback path

### OCR and media
- preserve source images as evidence
- process in batches
- retain confidence/provenance per extraction
- never promote raw OCR as authoritative
- use free local/open-source processing where technically adequate

### Security engines
- run independent layers where feasible
- avoid unnecessary duplicate downloads
- cache immutable engine assets when permitted by their licensing/runner model
- fail closed on missing required security guarantees

### UI / graphics
- progressive loading
- compressed and appropriately sized assets
- no blocking network dependency for core navigation
- accessible fallback presentation when optional graphics fail
- measure bundle and render-cost changes

## Automatic improvement loop
`measure -> compare baseline -> detect regression/opportunity -> propose change -> CI/security -> independent review -> merge -> re-measure`

A change is not considered an improvement merely because it is newer; it must demonstrate better or equivalent correctness, security, maintainability, and relevant performance characteristics.

## Free-first rule
No component may introduce a paid external dependency as a silent requirement. If an external provider is ever considered, the system must retain an identified free/open alternative and documented migration path before adoption.
