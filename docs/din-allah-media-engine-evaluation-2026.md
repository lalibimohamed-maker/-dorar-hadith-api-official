# 🎬 Din Allah Media Engine — Building Evaluation

## Goal

Build an evidence-driven, self-hosted media engine for the Din Allah Encyclopedia. The engine is evaluated as a **production pipeline**, not as a single video model.

The evaluation deliberately separates:

1. visual generation quality;
2. scientific plausibility and editorial quality;
3. Quranic text integrity;
4. recitation provenance and audio integrity;
5. media rights/provenance;
6. final composition quality.

## Current benchmark foundations

The first candidate backends are Wan 2.2, CogVideoX 2B/5B, HunyuanVideo 1.5 and LTX-2.x. Their licenses are recorded individually because "open", "open weights", and "commercially usable" are not equivalent.

VBench is used as a baseline automated video-generation benchmark, while Din Allah adds domain-specific gates that VBench does not establish for us. VBench evaluates multiple dimensions of generative-video quality and provides an evaluation suite for video models.

## Why we do not train a giant model first

The first milestone is to prove that the **engine architecture and evaluation loop work**. A model can be swapped without changing the Quran, provenance, rights, composition, or QA layers. Later, the strongest legally suitable foundation can be fine-tuned or replaced with a Din Allah-specific model trained only on data for which we have documented training rights.

## Evaluation flow

`prompt suite → candidate generation → automated metrics → Din Allah QA → human review → scorecard → winner/runner-up → composition benchmark`

## Din Allah scorecard

Each candidate is scored on a 0–100 scale across:

- Prompt fidelity: 15
- Temporal/spatial consistency: 15
- Imaging quality: 10
- Motion quality: 10
- Biological/scientific plausibility: 15
- Artifact resistance: 10
- Editorial usefulness for explanatory visuals: 10
- Controllability / reproducibility: 5
- Resource efficiency: 5
- License/provenance suitability: 5

The final score is not enough by itself: hard failures override score-based ranking.

## Hard failures

A candidate is rejected for the benchmark output if it:

- inserts or corrupts Quranic text inside the generated visual;
- cannot provide required model/checkpoint provenance;
- has unresolved rights restrictions incompatible with the intended use;
- produces a requested composition with missing or invalid required audio;
- creates scientifically misleading visuals when the scene is explicitly presented as factual evidence;
- cannot reproduce the same approved configuration sufficiently for audit.

## Quran composition rule

The video model never generates the canonical Quranic text and never generates the Quranic recitation as a substitute for a verified source. The Quran layer is added later:

`verified ayah ID → canonical text → verified recitation → typography → timing → final mix`

The text is immutable after selection except for purely visual layout operations.

## First benchmark topic

The first benchmark uses the ant example because it tests:

- fine anatomy;
- multiple moving objects;
- natural environment;
- social behavior;
- close-up cinematography;
- later attachment of Surah An-Naml 27:18 as a separate religious layer.

The benchmark is not allowed to conclude "scientific miracle" from visual similarity. The scientific claim and the Quranic interpretation remain distinct evidence layers.

## License strategy

We prefer foundations whose code/checkpoint terms permit our intended use. Every selected model/version gets a license record containing:

`model → checkpoint → repository → license → date checked → restrictions → commercial status → derivative/fine-tuning status`

LTX-2.x is **not treated as unrestricted OSS**: its August 11, 2026 community license contains conditions including a paid-license requirement for entities meeting the stated revenue threshold, and its data definition explicitly separates training data from the model license. citeturn265757search0

CogVideoX 2B is documented by its official repository as Apache-2.0 for the 2B model, while CogVideoX 5B uses a separate CogVideoX license. citeturn265757search5turn265757search3

HunyuanVideo 1.5 is under a Tencent Hunyuan Community License. citeturn265757search9

## Success criterion for this phase

We do **not** claim that the media engine is ready for production merely because one model renders a nice clip. Success means:

- the benchmark is reproducible;
- candidates are measured by the same prompts;
- rights are machine-checkable;
- Quran text and recitation are separate immutable assets;
- final media has complete provenance;
- the composition path can prove the presence and validity of required audio;
- a human reviewer can inspect the final result and score it.

The first deliverable is therefore a **working evaluation harness and scorecard**, followed by a real model comparison when compute is available.
