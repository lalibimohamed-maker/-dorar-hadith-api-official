# Dinullah Islamic Open Knowledge Infrastructure

## Vision

Dinullah is being developed as an interoperability layer for source-attributed Islamic digital knowledge, not merely as a text API.

The architecture has five permanent boundaries:

1. Source layer — external institutions, libraries, APIs and authorized repositories.
2. Evidence layer — retrieved objects, citations, editions, scholarly attributions and acquisition events.
3. Curated Corpus layer — reviewed material only; raw acquisition never crosses this boundary automatically.
4. Knowledge layer — stable identities and relationships between people, works, editions, hadith, Quranic units, sources and evidence.
5. Delivery layer — API, search, SDKs, CLI, MCP, datasets and research exports.

## Core object model

Person, Work, Edition, Volume, DigitalObject, Source, Evidence, AcquisitionEvent, VerificationEvent, RightsRecord, ReleaseAsset, QuranUnit, HadithRecord, Narrator and Relation are the initial shared object types.

Every object should have a stable identifier and, when available, external identifiers.

## Provenance

A reproducible acquisition path is represented as:

Source -> Discovery -> Acquisition -> Conversion -> Repair -> Quality Gate -> Hash -> Rights -> Release

A derived PDF must retain original format, conversion tool/version, source URL, acquisition timestamp, SHA-256, validation result, rights state and derivation relationship.

A DOCX converted to PDF is a real PDF artifact, but its provenance must say source_format=docx and derivation=docx_to_pdf.

## Rights

Rights are independent from technical acquisition.

Suggested states: public, licensed, review_required, restricted, unknown.

Unknown and review_required do not authorize public redistribution.

## Knowledge graph

Relationships are evidence-bearing. The graph must not silently collapse scholarly disagreements.

Example: Hadith -> graded_by -> Scholar.

The graph stores the scholar's documented grading and its source; it does not manufacture a single universal grading when sources disagree.

## Quran boundary

Canonical Arabic Quran text remains separate from translations.

Translations are source-attributed human/institutional editions. Generated text must never be promoted as a Quran translation source.

## Digital-library interoperability

The roadmap targets interoperable exports where justified: JSON-LD/RDF for linked knowledge; IIIF for page/image presentation; ALTO for OCR layout; METS for digital-object structure; TEI for scholarly text encoding; JSONL/Parquet/SQLite for datasets.

These are output/interoperability layers, not requirements that every source support every format.

## Developer surface

Planned public interfaces: REST/OpenAPI, JavaScript/TypeScript SDK, Python SDK, CLI, MCP server, downloadable snapshots, source/provenance APIs and evidence APIs.

## Quality principle

The project optimizes for traceability before scale:

source -> evidence -> provenance -> rights -> verification -> publication

A larger number of unverified objects is not considered an improvement.
