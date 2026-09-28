# Rechercher Learning Orchestrator — P0

## Purpose

This layer sits downstream of the verified corpus and above existing question/flashcard renderers. It decides what to practice, why, at what difficulty, and when to review. It does not mutate canonical corpus content and must never block acquisition.

## P0 implemented

### Unified scheduler

The scheduler registry exposes one contract for FSRS-shaped modern scheduling, SM-2 compatibility/reference scheduling, Leitner box scheduling, interpretable forgetting-curve scheduling, and deadline-aware scheduling.

The FSRS adapter is explicitly marked as a compatibility implementation rather than canonical FSRS parameter/training parity.

Scheduler state includes stability, difficulty, retrievability, interval, repetition/ease data where applicable, and timestamps. The orchestrator isolates state by learner and content context.

### Central selector

The central selector scores candidate learning objects using:

due, retrievability-risk, recent-error, mastery-gap, prerequisite-gap, confidence-mismatch, novelty, interleaving-value, transfer-value, source-diversity, and time-budget.

The resulting decision includes the selected item, skill/source IDs, mode, reasons, predicted retrievability, target difficulty, next review, confidence prompt, and transfer follow-up.

### Evidence and provenance

Every learning object requires an item ID, source ID, and a source anchor/page/location. Lifecycle state is explicit, publication requires source verification, and source changes can invalidate affected learning objects.

Lifecycle:

draft → machine-generated → source-verified → scholar-reviewed → published → deprecated.

### Learner model and confidence

Correctness and confidence are logged independently. Learning events can also record mode, response time, feedback, misconception/prerequisite signals, game events, delayed assessment, transfer assessment, and next review.

Mastery evidence requires at least one delayed or transfer assessment in addition to the mastery score. A game score alone is not mastery evidence.

### Acquisition boundary

Learning is downstream and non-blocking for PDF acquisition, preservation, rights processing, and corpus discovery.

## P0 decision contract

Example JSON fields:

itemId, skillIds, sourceIds, mode, reason, predictedRetrievability, targetDifficulty, nextReview, confidencePrompt, transferAfter.

## What remains for later priorities

P0 deliberately does not claim canonical FSRS parameter training, large-scale IRT estimation, deep knowledge tracing, multiplayer infrastructure, or production persistence.

P1 should add richer prerequisite routing, misconception remediation, learned difficulty adaptation, transfer generation from verified evidence, and progressive explanation depth.

P2 should add reusable game adapters whose events map back to skills and retrieval/feedback evidence.

P3 should add multimodal and offline review adapters.

P4 should add controlled method evaluation and scholar review workflows for higher-stakes learning objects.

## Safety and scientific boundary

Learning content is educational metadata and derived interaction data. Quran Arabic and canonical scholarly corpus data remain authoritative elsewhere. Machine-generated religious answers cannot become authoritative without verified evidence and the required review state.
