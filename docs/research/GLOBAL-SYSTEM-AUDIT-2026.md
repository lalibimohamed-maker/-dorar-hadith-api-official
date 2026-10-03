# Global System Audit — 2026-08-30

This document records the cross-system audit of the encyclopedia stack and the controls added to close integration gaps.

## Existing systems reviewed

- Corpus, provenance, source maps and write boundaries.
- Hadith, rijal and evidence-linking systems.
- Quran, tafsir, fiqh and faraid systems.
- Book catalog, rights, cache, ingestion and digitalization.
- OCR, scan cleanup and derived-edition processing.
- Global/federated search and scholarly engine mesh.
- Statement extraction and detailing.
- Knowledge graph and concept resolution.
- Voice, audio, image and video processing.
- Security, supply-chain, recovery and observability.
- Accessibility, multilingual and API/web runtime layers.

## Newly enforced cross-system controls

1. Source lineage and edition identity.
2. Quote-context preservation.
3. Semantic duplicate-source clustering.
4. Negative-evidence recording.
5. Temporal consistency and supersession checks.
6. Remote-content trust boundary and prompt-injection isolation.
7. Document-structure validation.
8. Speaker-attribution validation for audio/video.
9. Model-weight license checks independent of code licenses.
10. Resource and cost budgeting.
11. Claim-to-evidence completeness before scholarly promotion.
12. Global integration testing across subsystem contracts.

## Principle

Each engine may collect, parse, classify or analyze. No engine is itself a truth authority. A derived claim must retain its source, location, edition, context and uncertainty state.

## Free-first rule

No paid service is a mandatory dependency. Paid, quota-limited or model-license-restricted capabilities remain gated and cannot silently become the trusted core.

## Security rule

Remote material is data, not instructions. It cannot invoke tools, alter policy, grant privileges or bypass provenance and evidence controls.

## Promotion rule

`discover -> normalize -> verify -> link -> compare -> assess evidence -> synthesize -> uncertainty/review -> promote`
