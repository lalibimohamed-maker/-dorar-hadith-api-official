# Din Allah Media Engine — Clean Build 2026

A clean foundation for a separate media studio, built directly from current `main`.

## Pipeline

`brief → evidence packet → storyboard → visual source → quality evaluation → Quran text → verified recitation → sync → composition → master validation → human review → export`

The visual route may be original/self-hosted generation or lawfully cleared imported media. Public availability alone never grants reuse rights.

## Quran integrity

The video model never generates Quranic text or Quranic recitation. Arabic Quran text is bound from a verified canonical source and remains verbatim. Recitation is a separate rights-cleared asset. Meaning translations are distinct from the Arabic source.

## Scientific integrity

A generated scene is an illustration, not scientific evidence. Claims must remain linked to source evidence, with uncertainty and interpretive links kept explicit.

## Evaluation

VBench-2.0 is the primary external benchmark and VBench is a secondary baseline. VBench-2.0 expands evaluation beyond basic prompt/pixel quality to intrinsic faithfulness, commonsense reasoning, physics realism, human motion and creative composition, and it supports evaluation of custom videos for applicable dimensions. citehttps://github.com/Vchitect/VBench/blob/master/VBench-2.0/README.md

Custom gates cover Quran text integrity, recitation integrity, provenance, rights, unintended generated text, temporal consistency and audio-stream integrity.

## Candidate generation models

Candidates remain non-binding and are not installed by CI. Wan 2.2 is a strong first candidate because its official repository is public, dedicated to video generation, and declares Apache-2.0 for the repository. citehttps://api.github.com/repos/Wan-Video/Wan2.2

Exact checkpoint/model terms must still be recorded before production use.

## Why this build is different

No heavy video downloads. No documentary renderer in normal PR CI. No generated media committed to Git. No runtime dependency added. No Corpus mutation.

Actual model generation will run later on a dedicated compute runner, using the same prompt suite and scorecard so models are compared fairly.

## Output quality

48K remains a render ceiling, not a claim of native 48K generation. Text, Quran, citations and factual diagrams are rendered as independent clean layers at the final target size.
