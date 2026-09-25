# Dinullah Platform Scope — Locked Architecture

This document is the canonical scope for the next evolution of Dinullah Encyclopedia.

## Permanent pipeline

`Global Sources → Source Graph → Provenance / W3C PROV → Work / Edition / Author / Scholar Graph → Evidence Graph → Curated Corpus → Knowledge Graph → Multilingual Search → Research API → SDK → CLI → MCP → Datasets → Digital Library`

The sequence describes architectural dependencies, not a requirement that every stage be implemented in one release.

## Discovery Engine

Rechercher becomes a federated Discovery Engine, not only a URL finder.

For a discovered work, the engine should be able to connect evidence such as:

`Author → Work → Edition → Translation → DigitalObject → Source`

A result may report multiple sources, editions, translations, digital copies and manuscript/catalogue witnesses when supported by evidence. Discovery recall must not be reduced to one preferred provider.

## Scholar Graph

The Scholar Graph records documented relationships:

`Scholar → Works → Editions → Manuscripts → Commentaries → Biographical Sources → Translations → Languages`

Scholarly authority is represented through attributed evidence. The system must not invent a universal ranking, score or authority judgment.

## Edition Graph

The same work may have multiple editions, volumes, manuscripts, PDFs, OCR derivatives, DOCX sources and translations.

The graph distinguishes:

`Work → Edition → Volume → DigitalObject`

and preserves format and derivation metadata, so a digital copy is not incorrectly treated as a separate work.

## Evidence Graph

Evidence is represented as:

`Claim → Evidence → Source → Work → Edition → Page → Passage`

The objective is citation-level traceability: a response should be able to identify the exact source and version used for a claim.

## Multilingual Scholarly Search

The 3,192-cell matrix (133 languages × 24 domains) is the initial coverage target, not the final search boundary.

Semantic matching may connect equivalent concepts across languages, but semantic similarity must never be presented as proof that two texts are identical translations.

Canonical Arabic Quran text remains separate from translations. Generated text is never promoted as a Quran translation source.

## Digital Library

Dinullah Digital Library targets interoperability with:

- PDF
- IIIF
- OCR / ALTO
- METS
- TEI
- JSON-LD
- JSONL
- SQLite
- Parquet

These are interoperable representations. A source does not need to support every format.

## Source Observatory

Rechercher should monitor:

`Source discovered → Source verified → Source changed → New edition → New translation → API changed → PDF replaced → Rights changed → Source unavailable`

Monitoring is metadata and evidence infrastructure; it does not silently authorize redistribution.

## Scientific Reproducibility

Every reproducible operation should be traceable through:

`run_id → source → URL → timestamp → tool → input → output → SHA-256 → quality → rights → provenance`

W3C PROV is the provenance interchange layer. Provenance recording must remain non-blocking for acquisition and storage.

## Research API

The research-facing API is designed around operations such as:

`findWork`
`findEdition`
`findAuthor`
`findEvidence`
`findTranslations`
`findSources`
`traceProvenance`
`compareEditions`
`searchMultilingual`
`findRelatedSources`

## Interoperability surfaces

The public developer surface is planned as:

`Research API → SDK → CLI → MCP`

The SDK and CLI are consumer interfaces over the same governed research model. MCP is an evidence-first agent interface, not an alternative source of religious text.

## Offline Islamic Data Commons

Release structured snapshots in formats appropriate to the data:

`JSONL`, `JSON`, `CSV`, `SQLite`, `Parquet`, `TEI`, `JSON-LD`

Metadata, indexes and provenance may be distributed separately from content whose rights do not permit redistribution.

## Benchmarks

Measure the system with reproducible datasets and versioned benchmarks, including:

`Source Recall`
`Edition Recall`
`Duplicate Detection`
`Language Coverage`
`Provenance Completeness`
`Rights Classification`
`PDF Quality`
`Citation Accuracy`

Benchmarks measure system behavior; they are not religious authority scores.

## Governance boundaries

1. System Layer remains above the Curated Corpus.
2. Discovery never equals permission to redistribute.
3. Rights remain item-level.
4. Acquisition outputs never write directly to Curated Corpus.
5. AI may assist discovery, matching and retrieval, but is not a religious source and never supplies Quran translation evidence.
6. Derived artifacts preserve their source and derivation provenance.
7. The project may add providers only when they fit the defined source/evidence model; no unrelated platform scope is added merely to increase feature count.

## Phased implementation

### V1 — Foundation
Current architectural foundations, governance, schemas, rights and provenance boundaries.

### V2 — Global Source Graph
Federated source registry, relationships, discovery expansion and source observability foundations.

### V3 — Provenance + Evidence Graph
W3C PROV exports, Claim/Evidence/Source/Work/Edition/Page/Passage graph and citation traceability.

### V4 — Edition & Digital Library Graph
Work/Edition/Volume/DigitalObject graph plus IIIF, OCR/ALTO, METS and TEI interoperability.

### V5 — Multilingual Research Engine
Cross-source, cross-language discovery and scholarly search over the 3,192-cell foundation.

### V6 — Research API + SDK + CLI
A single governed research model exposed through API, JavaScript/TypeScript, Python and CLI surfaces.

### V7 — MCP + Agent Interoperability
Evidence-first MCP tools with citation and provenance preservation.

### V8 — Public Islamic Research Infrastructure
Stable public snapshots, offline datasets, observatory dashboards and reproducible benchmarks.

## Non-goals

This scope does not include: unrelated application features, arbitrary content ingestion into Corpus, automatic religious authority scoring, AI-generated Quran translations, or rights-unsafe redistribution.
