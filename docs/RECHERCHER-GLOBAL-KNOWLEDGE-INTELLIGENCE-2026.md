# Rechercher — Global Deep Research / Worldwide Knowledge Intelligence

## Purpose

This layer turns Rechercher into a source-grounded discovery, evidence, learning, and research system. It is **not** a claim that Rechercher knows everything. Its purpose is to know where knowledge is, how records relate, where each assertion came from, how strong the evidence is, what remains unknown, and how a human can reach the original source.

## Canonical pipeline

`WORLD SOURCES → DISCOVERY → IDENTITY → DEDUPLICATION → PROVENANCE → RIGHTS → VERSION/EDITION/MANUSCRIPT → TEXT/IMAGE/AUDIO/VIDEO ALIGNMENT → KNOWLEDGE GRAPH → EVIDENCE GRAPH → CONTRADICTION/UNCERTAINTY → SEARCH → LEARNING → RESEARCH`

Discovery, synthesis, and verification remain separate stages. A relation inferred by software is not authoritative merely because it exists in a graph.

## Source identity

Every retained knowledge object should be addressable through a stable identity chain where available:

`source_id → work_id → edition_id → manifestation_id → page_id → passage_id`

Metadata also carries language, license, rights status, provenance, retrieval date, and content hash. The same work appearing in multiple libraries is deduplicated conceptually while preserving each manifestation, edition, scan, and provenance record.

## Global source federation

The registry is designed for national and university libraries, archives, manuscript repositories, digital repositories, scholarly graphs, Islamic corpora, books/PDFs, OCR, audio, video, images, maps, structured data, and the public web. Provider adapters must record query and retrieval provenance and must never silently convert a discovery result into a verified source.

## Discovery Intelligence

Rechercher records both positive and negative discovery evidence. A failed search is evidence that a source was not found under the recorded search conditions; it is **not proof that the source does not exist**. Gaps become explicit `Knowledge Gap` objects so later research can target them.

Examples include missing editions, unattested manuscript witnesses, unresolved bibliographic identity, unavailable translations, and references to sources not yet located.

## Manuscript / IIIF readiness

The model treats a scanned book or manuscript as a compound object rather than a bare URL. Page/canvas identity can be connected to image, OCR, transcription, normalized text, translation, and scholarly annotations while preserving the original artifact. IIIF Presentation 3.0 supports presentation and annotation of image, audio, and moving-image resources, making it an appropriate interoperability boundary for future multimodal work. citeturn0search2turn0search5

## Multilingual intelligence

Language is represented independently at three levels:

1. source language;
2. learning/explanation language;
3. interface language.

Terminology mappings are typed as exact, approximate, historical, school-specific, variant, or no-exact-equivalent. Arabic source terminology is retained where translation would lose precision.

## Evidence Graph

Claims and relations may connect to works, editions, pages, passages, scholars, hadith, narrators, events, madhhabs, commentaries, and translations. Every consequential relation carries status, evidence, confidence, provenance, and review state.

Supported relation families include `SUPPORTED_BY`, `CONTRADICTED_BY`, `EXPLAINS`, `COMMENTS_ON`, `QUOTES`, `ATTRIBUTED_TO`, `TRANSMITTED_BY`, `TRANSLATED_AS`, and `DERIVED_FROM`.

Contradiction is represented rather than silently resolved. Scholarly disagreement remains visible and source-linked.

## AI trust layer

A future research answer must be decomposable into:

- direct source evidence;
- derived information;
- scholarly interpretation;
- AI synthesis;
- uncertainty;
- source list.

AI-generated synthesis is not authoritative without human review. Unknown evidence stays unknown; hypotheses stay hypotheses. This is consistent with the NIST AI RMF approach of governing, measuring, and evaluating AI risks across the lifecycle, including generative-AI-specific risks and test/evaluation practices. citeturn0search0turn0search3turn0search6

## Non-bypassable safety contract

The Global Knowledge Intelligence layer:

- cannot stop or disable PDF acquisition;
- cannot bypass rights or provenance gates;
- cannot modify retained original PDFs;
- cannot modify canonical Quran Arabic;
- cannot erase madhhab or scholarly disagreement;
- cannot turn an AI proposal into authoritative religious content without human review;
- cannot publish restricted or rights-unknown material;
- cannot treat graph inference as source evidence.

The dependency direction is therefore:

`Acquisition → Validation → Rights → Provenance → Corpus → Knowledge → Learning → Research`

and never the reverse.

## Strategic evolution

This layer is an architectural foundation for the previously defined evolution:

- V1–V4: Foundation / Learning Intelligence
- V5–V12: Learning Intelligence
- V13–V20: Global Knowledge Infrastructure
- V21–V30: World Knowledge Intelligence
- V31+: Knowledge Commons / Research Ecosystem

Future generations must be implemented and tested incrementally; roadmap status must never be represented as completed functionality.
