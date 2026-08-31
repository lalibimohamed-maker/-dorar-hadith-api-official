# موسوعة دين الله — Content Completeness Control 2026

## Purpose

This document is the canonical control sheet for the scientific content scope agreed for the Din Allah Encyclopedia. It distinguishes **implemented structure**, **catalogued sources**, and **actual scholarly content availability**. A feature flag, schema, catalog entry, or source link does **not** count as completed scholarly content.

## Evidence states

- `implemented`: the data/content layer is present and usable in the repository.
- `catalogued`: a work/source is identified with provenance, but full content is not yet ingested.
- `rights_pending`: content is known but redistribution rights or edition evidence is incomplete.
- `verification_pending`: content exists or is proposed but needs scholarly/source verification before promotion.
- `discovery_only`: reference material helps discover sources but is not authoritative content.
- `foundation_only`: infrastructure/schema exists; scholarly population remains to be done.

## Scope matrix

| Domain | Required scope | Current state | Immediate completion requirement |
|---|---|---|---|
| Quran | verified Arabic text, ayah identity, context links, scholarly layers | `implemented` + `foundation_only` | continue coverage audit and attach scholarly records without mixing layers |
| Tafsir | broad catalog of tafsir works; full text only where lawful; source/edition/provenance | `catalogued` | expand catalog systematically and populate licensed/public-domain texts |
| Tadabbur & Hidayat | independent from tafsir; source, author/project, rights, evidence | `catalogued` | verify project editions/rights and ingest permitted material |
| Seerah | actual event records, chronology, evidence state, source references, variants | `foundation_only` | populate event records from verified sources; never invent missing dates/reports |
| Hadith | text, takhrij, grades, variants, isnad, narrators, source edition, rights | `implemented` + `foundation_only` | expand source-text coverage and connect scholarly commentary separately |
| Hadith commentary | explanation tied to hadith, scholar/work, edition/page or source link | `foundation_only` | create commentary records with explicit author/source attribution |
| Books | catalog, author, edition, publisher, rights, source URL, OCR/source image provenance | `implemented` + `catalogued` | expand catalog and ingest only content permitted by rights |
| Visual learning | mind maps, surah maps, thematic/semantic maps, simplification assets | `catalogued` | identify works/assets and record rights before redistribution |
| Translations | per-language translation registry, version, translator, rights, provenance | `foundation_only` | verify and populate translations one language/source at a time |
| Recitation audio | verified reciter registry, audio source, rights, coverage, timing | `foundation_only` | enable reciters only after source/rights/integrity/timing verification |
| OCR | source image + OCR text + confidence/provenance + human verification | `foundation_only` | build edition-level OCR pipeline and never promote raw OCR as authoritative |
| Source refresh | change detection, provenance, rights, quarantine, review, promotion history | `implemented` | continue scheduled source synchronization and human review of changes |
| Scientific separation | original text vs commentary vs summary vs translation vs fatwa vs AI analysis | `implemented` at schema/architecture level | enforce separation across every ingestion and rendering path |

## Non-negotiable content rules

1. **No work is considered complete because its title appears in a catalog.**
2. **No copyrighted full text is redistributed without documented permission or a clearly lawful redistribution basis.**
3. **OCR output is never authoritative by itself.** The source image and verification state remain linked.
4. **Historical reports are not silently upgraded to facts.** Evidence/reliability state stays attached to each record.
5. **Hadith text, grading, commentary, and AI analysis remain separate records.**
6. **A translation is not treated as the Quranic Arabic source.** Translation identity, translator, version, and rights are preserved.
7. **Discovery sources remain discovery sources.** Search results and secondary aggregators do not become primary scholarly evidence merely by being indexed.
8. **Missing information remains explicitly missing.** Do not fabricate dates, quotations, editions, rights, or attribution to fill gaps.
9. **Every promoted scholarly record must preserve provenance and source identity.**
10. **Every content change goes through the repository's protected review/validation pipeline before promotion to `main`.**

## Completion order

### Track A — Quran scholarly layers

Finish the tafsir/tadabbur/hidayat/visual-work catalog, then populate lawful source texts and verse-level references. Keep Arabic Quran text separate from all explanatory material.

### Track B — Seerah population

Convert the existing chronological scaffold into event records. Each event requires source references and evidence/reliability state. Competing reports remain linked as variants rather than overwritten.

### Track C — Hadith expansion

Continue from the existing corpus contracts into broader text coverage, takhrij, isnad/narrator linkage, variants, and independently sourced commentary.

### Track D — Books and OCR

Expand book metadata first, then edition/source-image capture, OCR, quality scoring, human verification, and rights-aware publication.

### Track E — Translation and recitation

Populate only verified language/translation records and verified reciter records. Keep unavailable material disabled rather than presenting placeholders as content.

## Definition of done

A scientific content domain is **complete only when**:

- its required source universe has been systematically catalogued;
- each record has provenance and rights state;
- permitted full text has been ingested and verified where applicable;
- non-redistributable works have authoritative metadata + official discovery links instead of unauthorized copies;
- cross-links to Quran/Hadith/Seerah/Books are explicit and traceable;
- tests validate that the content layer does not collapse distinct scholarly roles;
- refreshes are auditable and reversible.

This document is a control artifact, not a claim that every listed domain is already complete.