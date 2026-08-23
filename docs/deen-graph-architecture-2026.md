# Deen Allah Encyclopedia — Integrated Knowledge Graph

## Purpose

The encyclopedia is modeled as one source-aware knowledge graph, not as isolated Quran, hadith, tafsir, sirah, fiqh, aqeedah and fatwa modules.

Every node and relationship must retain provenance. Generated text may explain retrieved evidence but can never become evidence merely because an AI model produced it.

## Canonical flow

Quran verse -> tafsir -> asbab al-nuzul -> sirah/context -> related hadith -> narrators/rijal -> hadith criticism -> explanation -> fiqh/aqeedah/benefits -> scholar statements -> fatwa.

The reverse traversal is also supported: a hadith, ruling, scholar statement or fatwa can lead back to the underlying primary texts and citations.

## Evidence layers

1. **Primary text** — original Quran/hadith/source text where redistribution rights permit.
2. **Scholarly interpretation** — attributed tafsir, commentary, explanation, ruling or statement.
3. **Metadata** — catalog, edition, chapter, identifiers and bibliographic data.
4. **Relations** — explicit source-backed links between records.
5. **Generated assistance** — search summaries or explanations produced by software; never promoted to source evidence.

## Verification states

`ingested` -> `pending_review` -> `pending_verification` -> `source_verified` -> `edition_verified` -> `scholar_reviewed`.

Only verified states may enter trusted evidence paths. Conflicting scholarly judgments remain separately attributable; disagreement is data, not an error to erase.

## Hadith first gate

The current implementation phase is real hadith corpus ingestion. The existing manifest is an ingestion contract, not proof that the eight listed books have been legally and textually ingested. Each source must pass source, edition, rights and integrity checks before trusted indexing.

## Quran/tafsir/sirah gate

After the hadith corpus passes its gates, Quran, tafsir, asbab al-nuzul and sirah are added using the same graph contract. Their records will link into the existing hadith graph rather than create a second incompatible model.

## Design invariants

- Never invent citations.
- Never silently merge materially different hadith variants.
- Never infer authenticity from catalog membership alone.
- Never turn a search rank into a religious judgment.
- Preserve the source identity, edition and attribution when available.
- Preserve legitimate scholarly disagreement.
- Keep generated prose distinguishable from source text.
- Keep copyright/reuse status attached to every corpus source.
- Every graph edge must identify its provenance.
