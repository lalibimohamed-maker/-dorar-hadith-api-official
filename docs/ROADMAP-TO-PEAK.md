# Roadmap to the Peak

The canonical scope is locked in [Dinullah Platform Scope](./DINULLAH-PLATFORM-SCOPE.md).

## Permanent architecture

`Global Sources → Source Graph → Provenance / W3C PROV → Work / Edition / Author / Scholar Graph → Evidence Graph → Curated Corpus → Knowledge Graph → Multilingual Search → Research API → SDK → CLI → MCP → Datasets → Digital Library`

## V1 — Foundation

- [x] System Layer separated from curated Corpus.
- [x] Source, provenance and rights concepts.
- [x] PDF validation and SHA-256 pipeline.
- [x] DOCX to validated PDF fallback.
- [x] Matrix target: 133 × 24 = 3,192 cells.
- [x] Quran-specific acquisition/API layer.
- [x] Continuous book acquisition architecture.
- [x] Open-source governance metadata.

## V2 — Global Source Graph

- [x] Worldwide source-link registry.
- [x] Source relationship graph.
- [ ] Federated Discovery Engine with evidence-preserving source expansion.
- [ ] Source Observatory.
- [ ] Source health, capability and change monitoring.
- [ ] Cross-source work/edition discovery.
- [ ] Source-level and item-level rights observability.

## V3 — Provenance + Evidence Graph

- [x] W3C PROV-compatible provenance foundation.
- [ ] Full Claim → Evidence → Source → Work → Edition → Page → Passage model.
- [ ] Citation-level evidence API.
- [ ] Reproducible acquisition manifests connected to every digital object.
- [ ] Provenance and evidence consistency tests.

## V4 — Edition & Digital Library Graph

- [ ] Work / Edition / Volume / DigitalObject graph.
- [ ] Author / Scholar graph with attributed evidence.
- [ ] Edition deduplication and entity resolution.
- [ ] IIIF interoperability.
- [ ] OCR / ALTO where source quality permits.
- [ ] METS-style digital-object packaging where useful.
- [ ] TEI exports for curated scholarly text.
- [ ] Page, volume, edition and derivative relationships.

## V5 — Multilingual Research Engine

- [x] 133 × 24 = 3,192-cell foundation.
- [ ] Cross-source multilingual discovery.
- [ ] Cross-language concept matching.
- [ ] Language-aware edition and translation linking.
- [ ] Source Recall benchmark.
- [ ] Edition Recall benchmark.
- [ ] Language Coverage benchmark.
- [ ] Citation Accuracy benchmark.

## V6 — Research API + SDK + CLI

- [ ] Stable research API.
- [ ] OpenAPI specification.
- [ ] `findWork`.
- [ ] `findEdition`.
- [ ] `findAuthor`.
- [ ] `findEvidence`.
- [ ] `findTranslations`.
- [ ] `findSources`.
- [ ] `traceProvenance`.
- [ ] `compareEditions`.
- [ ] `searchMultilingual`.
- [ ] `findRelatedSources`.
- [ ] JavaScript/TypeScript SDK.
- [ ] Python SDK.
- [ ] CLI.

## V7 — MCP + Agent Interoperability

- [ ] Evidence-first retrieval tools.
- [ ] MCP server.
- [ ] Citation-preserving agent responses.
- [ ] Provenance-preserving agent responses.
- [ ] Retrieval benchmark suite.
- [ ] Multilingual Islamic retrieval benchmark.
- [ ] Arabic OCR benchmark.

## V8 — Public Islamic Research Infrastructure

- [ ] Stable release snapshots.
- [ ] Offline Islamic Data Commons.
- [ ] JSONL / JSON / CSV datasets.
- [ ] SQLite datasets.
- [ ] Parquet datasets.
- [ ] TEI and JSON-LD exports.
- [ ] Metadata/index/provenance distributions separated from rights-restricted content.
- [ ] Public Source Observatory.
- [ ] Reproducibility reports.

## Definition of completion

A researcher, library or developer should be able to discover a source, identify the exact work and edition, trace the evidence to a page or passage, inspect provenance and rights, reproduce validation, and consume the governed result through search, API, SDK, CLI, MCP, dataset or digital-library interfaces.

The project optimizes for traceability before scale. Popularity is not an engineering or scholarly quality gate.
