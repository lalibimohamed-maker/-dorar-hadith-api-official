# Din Allah Media Engine — Clean Build 2026

A clean, separate media-studio foundation built directly from `main`.

## Pipeline

`brief → evidence packet → storyboard → visual source → quality evaluation → Quran text → verified recitation → sync → composition → master validation → human review → export`

The engine is contract-first. Actual generation, media import, OCR, recitation processing, composition and export are adapters that must pass the gates defined here.

## Integrity boundaries

Quranic Arabic text is bound from a verified canonical source and remains verbatim. The video model never generates Quranic text or Quranic recitation. Recitation is a separate rights-cleared Arabic asset. Translations remain distinct from the Arabic source.

Generated scenes are illustrations, not evidence. Claims must point to source-backed evidence. Uncertainty and interpretive links remain explicit.

## Rights and provenance

Public availability never implies reuse permission. Imported visuals, Quran text, recitation and exported media require explicit provenance and cleared reuse status. The contract does not grant rights by itself.

## Evaluation

VBench-2.0 is the primary external benchmark contract and VBench is the secondary baseline. CI does not download large video models or benchmark packages. Model generation happens later on dedicated compute using the same prompt suite and scorecard.

Custom gates cover Quran text integrity, recitation integrity, provenance, rights, unintended generated text, temporal consistency and audio-stream integrity.

## Clean-build invariants

- No heavy video downloads in ordinary PR CI.
- No generated media committed to Git.
- No runtime dependency added by the media layer.
- No Corpus mutation.
- No blocking dependency on Rechercher acquisition.
- 48K is a render ceiling, not a claim of native 48K generation.
- Text, Quran, citations and factual diagrams are separate clean composition layers.

## Future adapters

Generation models, visual import connectors, OCR, recitation alignment, audio/video sync, composition and exporters remain replaceable adapters. Exact model/checkpoint terms and rights are recorded before production use; candidate models are non-binding.
