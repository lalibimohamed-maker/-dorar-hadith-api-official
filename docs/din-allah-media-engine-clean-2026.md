# 🎬 Din Allah Media Engine — Clean Build 2026

This is a clean operational foundation built directly from the current `main` branch. It is deliberately smaller than the retired prototypes.

## What this build does

It defines a deterministic contract for a separate media studio. A future video run follows:

`brief → evidence packet → storyboard → visual source → quality checks → Quran layer → verified recitation → sync → composition → master validation → human review → export`

The engine accepts two visual routes:

1. original/self-hosted generation;
2. lawfully cleared imported media.

A discovered internet video is never automatically treated as reusable.

## Religious integrity

The video model never authors Quranic text or Quranic recitation. Quran Arabic is bound from a verified source and stays verbatim. Recitation is a separate asset with its own rights record.

Translations of meanings remain distinct from the Arabic source.

Scientific statements stay linked to evidence records. A visual resemblance, generated scene, or popular claim is not promoted to scientific fact by itself.

## Evaluation

The external quality benchmark is **VBench-2.0**, with VBench retained as a secondary baseline. VBench-2.0 explicitly evaluates advanced dimensions such as intrinsic faithfulness, commonsense reasoning, physics realism and creative composition, and supports custom videos for applicable dimensions. citehttps://github.com/Vchitect/VBench/blob/master/VBench-2.0/README.md

For the encyclopedia itself, the custom gates include provenance, rights, Quran-text integrity, recitation integrity, unintended-text rejection and audio-stream validation.

## Candidate models

The first candidate registry is intentionally non-installing and non-binding. Wan 2.2 is especially useful for evaluation because its official repository is public, identifies the project as video generation, and declares Apache-2.0 for the repository. citehttps://api.github.com/repos/Wan-Video/Wan2.2

Other model families remain candidates until their exact checkpoint and terms are verified.

## No fragile CI rendering

This clean build does **not** download multi-hundred-megabyte footage or attempt a documentary render on every pull request. CI validates the contract and evaluation logic only. Actual generation belongs to a dedicated runner that can be added later without coupling heavy media to the application repository.

## 48K

48K remains a render/output ceiling, not a claim of native 48K generation. Text, Quran, citations and diagrams are rendered as independent clean layers at the final target resolution.
