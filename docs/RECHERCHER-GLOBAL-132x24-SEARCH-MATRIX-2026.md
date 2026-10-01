# Rechercher — Global 133 × 48 Search Matrix

## Objective

Rechercher now treats the current first-party IslamHouse snapshot of **133 enumerated languages** as a concrete research universe across 48 Islamic knowledge domains: **6,384 deterministic search cells**.

The previous 132-language snapshot had one missing enumerated language. The current official IslamHouse catalogue reports 133 languages and explicitly includes **Bengali** in the language selector. Bengali is therefore promoted from the discrepancy state into the evidence-backed language registry; no language was invented or inferred.

## Cell pipeline

Every cell follows the same evidence order:

`primary/institutional source → official API → corpus → structured web → scholarly dataset → translation metadata → provenance → rights → verification`

A failed or missing stage does not fabricate a result. The cell remains queued with its current evidence state.

## Translation policy

Allowed states:

`source-verified → institutionally-reviewed → scholarly → provenance-complete → candidate → unverified`

Additional explicit states:

- `translation-needed`: no suitable human/institutional translation was found yet.
- `machine-translated`: optional fallback only; never promoted automatically to verified.

## Quran boundary

The canonical Arabic Quran is an isolated corpus layer. Human translations are separate resources. Machine translations are separate unverified fallback resources. No translation lane can overwrite canonical Arabic Quran content.

## Resource domains

The matrix uses exactly 48 Islamic knowledge domains. Domains 1–47 cover the explicit scholarly subjects, and domain 48 is the automatic catch-all for additional Islamic knowledge subjects with automatic subject classification. Supporting resource/governance lanes are not separate matrix dimensions.

## Expansion rule

106 is a minimum evidence-backed target, not a ceiling. Newly evidenced languages and sources enter the queue beyond 106. Rechercher must prefer discovering real resources over manufacturing complete-looking language coverage.

## First-party anchors

- IslamHouse: official language catalogue and API service.
- QuranEnc: translation catalogue/API and downloadable structured formats.
- Quran Foundation: Content API and incremental Content Sync for translations, tafsirs and related public resources.
- HadeethEnc: multilingual translated Prophetic-hadith resources.

These providers are discovery/evidence anchors; item-level rights and provenance still govern downstream use.
