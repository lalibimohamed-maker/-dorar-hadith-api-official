# Rechercher Learning Intelligence Engine v3 — Global Research 2026

## Purpose

This document records the research foundation for the next Rechercher learning-intelligence layer after v2. The objective is not to add arbitrary flashcard or game types, but to build a measurable learner model grounded in the verified corpus, evidence, prerequisite structure, misconceptions, calibration, multimodal learning signals, and continuous evaluation.

## Research thesis

The next architectural step is:

**Verified Corpus → Evidence Graph → Knowledge Graph → Prerequisite Graph + Misconception Graph → Learner Model → Diagnostic Engine → Method Selection → Practice/Reading/Game/Audio/Visual → Immediate + Delayed + Transfer Evaluation → Method Evaluation → Learner/Policy Update.**

Learning intelligence is downstream from acquisition. No graph, model, evaluation, or educational feature may block PDF discovery, acquisition, preservation, validation, or rights/provenance processing.

## 1. Knowledge Graph

Educational knowledge-graph research supports graph-based representations for personalized learning, curriculum design, concept mapping, recommendation, and learner-aware navigation. Rechercher should therefore represent concepts and relationships explicitly rather than treating learning items as isolated cards.

Core relations should include:

- related_to
- explains
- supports
- contrasts_with
- example_of
- derived_from
- prerequisite_of
- advanced_form_of
- depends_on
- requires

The graph must remain source-grounded: a concept relation should be traceable to evidence or explicitly marked as a machine-generated candidate awaiting validation.

## 2. Evidence Graph

For a religious encyclopedia, a Knowledge Graph alone is insufficient. Every educational claim should be traceable through an Evidence Graph where applicable:

**Learning item → Concept → Claim → Evidence → Source → Edition → Page/Passage → Provenance/Rights/Review state.**

This separates pedagogical convenience from authoritative source status and prevents the learning engine from silently becoming a source of religious claims.

## 3. Prerequisite Graph

Research on prerequisite relation learning shows that prerequisite structure can be inferred and used to route learners toward missing foundations. Rechercher should distinguish prerequisite strength and direction instead of treating all concepts as equally related.

Suggested relations:

- requires
- strongly_requires
- recommended_before
- parallel_to
- advanced_form_of
- depends_on

When a learner fails an advanced concept repeatedly, the system should test prerequisite hypotheses before merely presenting more repetitions of the same item.

## 4. Misconception Graph

A wrong answer is not necessarily a single isolated failure. Conceptual-change and erroneous-example research supports explicitly identifying recurring misconception patterns and using refutation, explanation, and re-testing where appropriate.

A Rechercher misconception record should be treated as a hypothesis until supported by sufficient learner evidence and, for sensitive religious claims, appropriate scholarly/source validation.

Suggested relations:

- triggered_by
- causes_error_in
- confused_with
- contradicts
- corrected_by
- re_test_with

The engine must distinguish memory failure, terminology confusion, source-attribution error, contextual misunderstanding, legitimate scholarly disagreement, and genuine conceptual misconception.

## 5. Calibration Model

Confidence must remain separate from correctness and mastery. Research on calibration shows that confidence and accuracy are related but imperfectly aligned, with domain and measurement effects.

Rechercher should therefore track at least:

- correctness
- confidence
- calibration bias
- overconfidence risk
- underconfidence risk
- confidence history by skill/context

A high-confidence wrong answer should be diagnostically different from a low-confidence wrong answer. A correct answer obtained with very low confidence should also trigger a different intervention from stable, confident mastery.

## 6. Multimodal Learner Profile

Recent multimodal learning-analytics research indicates potential value in combining multiple learning signals, while also highlighting privacy, interpretability, integration, and generalization challenges.

Rechercher should support privacy-preserving performance profiles across:

- text retrieval
- audio retrieval/listening
- visual/diagram interaction
- spoken explanation when explicitly enabled
- source navigation
- response latency
- confidence
- transfer performance

The default should be educational performance data, not unnecessary biometric surveillance. Sensitive modalities must remain opt-in and governed.

## 7. Method Registry

Every instructional method should be represented as a versioned method rather than hard-coded as an unquestioned best practice.

Examples include:

- retrieval practice
- spaced review
- interleaving
- elaboration
- worked examples
- self-explanation
- concept mapping
- refutation/correction
- source-location recall
- comparison/classification
- teach-back
- transfer practice
- games
- audio practice
- visual practice

Each method should declare target skills, prerequisites, intended learning stage, feedback requirements, and evaluation outcomes.

## 8. Method Ablation

Rechercher should test methods instead of assuming that more features produce better learning.

For a suitable population and skill, compare interventions such as:

- retrieval only
- retrieval + explanation
- worked example + self-explanation
- flashcard + delayed retrieval
- concept map + retrieval
- game + retrieval
- mixed/interleaved practice

Measure more than immediate correctness:

- immediate accuracy
- delayed retention
- transfer
- confidence/calibration
- recurring errors
- time/effort
- cognitive-load indicators where ethically and technically justified

The purpose is to learn which intervention works for which learner state and content type.

## 9. Continuous Evaluation

The Learning Evaluation Engine should form a closed loop:

**Intervention → Immediate test → Delayed test → Transfer test → Calibration → Method outcome → Policy/learner update.**

Evaluation must be longitudinal where possible. A method that improves immediate scores but harms delayed retention or transfer should not automatically be promoted.

The evaluation system should support baselines, intervention versions, outcome records, and ablation results without exposing unnecessary personal data.

## 10. LLM role

Recent graph-grounded and adaptive-learning research supports combining graph structure, learner history, planning, and generative models rather than relying on an LLM alone.

For Rechercher:

**Corpus + Evidence + Graph + Learner Model = grounding and constraints.**

**AI/LLM = explanation, generation, dialogue, candidate relation discovery, and adaptive assistance under those constraints.**

LLM output must not silently become canonical religious content.

## 11. Religious-content safeguards

For the Din Allah Encyclopedia, educational intelligence must preserve the distinction between:

- canonical Quran Arabic text
- source-grounded hadith material
- scholarly positions
- legitimate disagreement
- machine-generated educational hypotheses
- user-specific learning diagnostics

Unknown rights must not become publicly downloadable content merely because it is educationally useful. Rights/provenance checks remain mandatory.

## 12. Proposed v3 architecture

```text
Verified Corpus
      ↓
Evidence Graph
      ↓
Knowledge Graph
   ↙        ↓        ↘
Prerequisite  Concept  Misconception
   Graph       Graph      Graph
      \         |        /
       \        |       /
          Learner Model
               ↓
        Diagnostic Engine
               ↓
          Method Selector
               ↓
 Practice / Reading / Audio / Visual / Game
               ↓
     Immediate / Delayed / Transfer
               ↓
       Continuous Evaluation
          ↙            ↘
 Learner-state update   Method-policy update
          \            /
             New Plan
```

## 13. Priority implementation order

### P0

1. Graph schemas and identifiers.
2. Evidence/provenance links.
3. Prerequisite graph.
4. Learner mastery graph.
5. Calibration state.
6. Non-blocking acquisition boundary.

### P1

1. Misconception graph.
2. Transfer evaluation.
3. Method registry.
4. Source-grounded learning-item lifecycle.
5. Progressive explanation depth.

### P2

1. Method ablation.
2. Continuous evaluation.
3. Interleaving/difficulty policy evaluation.
4. Multimodal performance profile.

### P3

1. Dynamic graph evolution.
2. Scholar review workflows for sensitive relations.
3. Offline/PWA graph-aware review queue.
4. Cross-language concept alignment with canonical-source safeguards.

## 14. Quality rule for future additions

Rechercher should add a new learning method, game, modality, or algorithm only when it has a defensible educational purpose, source/provenance compatibility, measurable outcome, privacy justification, and a clear place in the learner model or evaluation loop.

The system should prefer a smaller set of validated methods over an ever-growing collection of decorative features.

## 15. Acquisition independence invariant

This research layer is strictly downstream of acquisition.

**Learning failure must never fail PDF acquisition.**

**Graph failure must never fail PDF acquisition.**

**Evaluation failure must never fail PDF acquisition.**

**Multimodal failure must never fail PDF acquisition.**

Acquisition remains responsible for discovering, downloading, preserving, validating, normalizing, and recording real PDFs subject to rights/provenance policy.

## Research basis

The architecture was informed by international research and reviews covering educational Knowledge Graphs, prerequisite relation learning, misconception/conceptual-change interventions, confidence calibration, multimodal learning analytics, retrieval practice, adaptive learning, graph-grounded generative tutoring, and method/effect evaluation. These sources are treated as evidence for architectural directions rather than proof that any one algorithm is universally optimal.

## Status

This document is an architectural research record for Rechercher Learning Intelligence Engine v3. It should evolve as higher-quality international evidence appears. New additions should be incorporated only when they materially improve learning quality, explainability, measurement, source grounding, accessibility, or learner outcomes.
