# Global System Review — 2026-08-30

## Current state
The repository already contains source-aware corpus, search/discovery, evidence orchestration, scholar/rijal ingestion, media processing, PWA/offline, security, rights, provenance, and free-first toolchain layers.

## Final capability map
- Global federated search and specialist dispatch.
- Evidence extraction, claim/evidence linking, statement extraction, context expansion, detailing, contradiction detection, sufficiency gating.
- Historical-book restoration, multi-engine OCR, diplomatic transcription, glyph repair gates, readable derived editions, multi-format export.
- Multilingual translation mesh with local/open engines, language dictionaries/data, context-aware term/entity locking, evaluation and translation memory.
- Browser/shared cache, content addressing, edition isolation, study-calendar history, resume position and quota-aware eviction.
- Media/audio/image/video processing with provenance and rights gates.
- Security: remote-content trust boundary, least privilege, pinned Actions, fail-closed ambiguity handling.
- Continuous engine/capability discovery and license re-checking.

## Gaps treated as blocking until evidenced
1. Executable integration must match configuration claims.
2. CI results must exist for the current head before merge promotion.
3. Browser/shared cache needs real runtime tests, not only configuration.
4. Translation engines need language-pair coverage benchmarks; a single model must not silently become authoritative.
5. Historical reconstruction needs page-level visual diff and text-preservation tests on representative damaged scans.
6. Rights/provenance must survive every derived format.
7. Global search must report source diversity and dependency clusters, not raw result counts.
8. Future tool upgrades must pass license, security, regression and quality benchmarks before promotion.

## Merge rule
Do not merge because a manifest says a capability exists. Merge only after executable evidence demonstrates the capability or after the change is explicitly marked as contract-only.
