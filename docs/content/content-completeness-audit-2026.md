# Din Allah Encyclopedia — Content Completeness Audit (2026)

## Purpose

This document distinguishes **implemented content infrastructure** from **actual scholarly content coverage**. A feature flag, schema, or catalog entry does not count as complete content.

## Status model

- `implemented-content`: actual content is present and reviewable.
- `catalog-seed`: metadata/seed entries exist, but coverage is not complete.
- `candidate`: discovered work requiring provenance/rights/methodology verification.
- `discovery-target`: identified as a target but not yet cataloged as a verified work.
- `feature-only`: UI/runtime capability exists without an equivalent verified content corpus.
- `rights-gated`: content may be linked or cataloged, but full-text redistribution requires permission.

## Current findings on main

### Quran / Tafsir / Tadabbur / Visual learning

`data/quran-knowledge-catalog.json` provides a source-aware catalog with an explicit completeness goal, provenance and rights policy, and seed/candidate/discovery entries for tafsir, tadabbur/hidayat, visual-learning, and collective works.

It is therefore **catalog-seed**, not a complete corpus. The catalog currently includes major works such as al-Tabari, Ibn Kathir, al-Sa'di, al-Jalalayn, al-Baghawi, al-Qurtubi, al-Tafsir al-Muyassar and al-Tafsir al-Wasit, while other entries remain candidates or discovery targets.

### Hadith

`config/hadith-corpus-catalog-2026.json` catalogs eight major collections: Bukhari, Muslim, Abu Dawud, al-Tirmidhi, al-Nasa'i, Ibn Majah, al-Muwatta and Musnad Ahmad.

The repository also contains hadith corpus, research, narrator, chain-evidence, assessment, variant-network, and ingestion modules. This is a strong **content infrastructure** foundation, but the catalog itself does not prove complete full-text coverage or complete sharh/takhrij coverage.

### Seerah

`config/features.json` declares a seerah experience with timeline and Quran-event links. Repository search did not find a dedicated seerah corpus/catalog comparable to the hadith catalog.

Status: **feature-only / gap**.

### Multilingual scholarly content

`config/features.json` declares 20 locales and locale-management capabilities. Scholarly translation output is currently disabled and verified meaning translation is not enabled by default.

Status: **i18n infrastructure exists; scholarly translation corpus is not yet complete**.

### Quran audio / reciters

`data/reciters.json` defines a rights-aware dynamic registry, but its `entries` array is currently empty. The configuration exposes reciter selection/download capabilities, yet no complete verified multi-reciter registry is present in this file.

Status: **infrastructure exists; verified reciter catalog is incomplete**.

### Books / OCR / rights

The repository contains a digital-book pipeline and rights-aware OCR tests. Separate merged work also established a rights-aware, provenance-preserving digital-book path. This should be treated as a **processing and governance layer**, not evidence that the encyclopedia already contains every requested book.

## Required content completion tracks

1. Complete the tafsir/tadabbur/hidayat/visual-learning catalog systematically, with measurable coverage.
2. Establish a dedicated seerah corpus with chronology, source identity and reliability state.
3. Expand hadith coverage and build a distinct sharh/commentary/takhrij layer without conflating it with hadith text.
4. Implement rights-aware scholarly translations as derived works with translator/version/provenance metadata.
5. Populate the Quran reciter registry only from verified authoritative audio sources with rights and timestamp evidence.
6. Continue the digital-books catalog and OCR pipeline while preserving source bytes, page provenance, rights state, and transformation history.

## Non-negotiable scholarly rules

- Discovery is not authority.
- A catalog entry is not full-text permission.
- OCR is a derived layer, never the canonical scholarly text by itself.
- Hadith text, grading, narrator evaluation, sharh, takhrij and modern analysis remain distinct records.
- Historical or disputed seerah reports retain explicit reliability/verification states.
- Translations remain derived works and must not overwrite the Arabic canonical text.
- Rights-unclear material stays link-only/quarantined.
- Existing authoritative content is never silently overwritten.
