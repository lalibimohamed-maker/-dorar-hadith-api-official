# Rechercher Learning Intelligence Engine v4 — implementation status

V4 adds four guarded layers above the v3 graph-grounded learning core:

- ephemeral session memory versus summarized long-term learner memory;
- bounded feedback-loop signals;
- explicit cross-domain transfer routing;
- pedagogical safety and source/rights alignment.

## Memory

Session memory contains current working context, recent items, recent micro-signals, and transient hypotheses. It is bounded and discardable.

Long-term memory stores summaries of mastery, calibration, misconceptions, modality performance, and transfer history. Raw session micro-events are not a default long-term diary.

## Feedback loop

The buffer accepts pause, hesitation, revision, hint request, answer attempt, confidence change, navigation, and completion signals. It is capped at 50 session signals and exposes a non-persistence invariant for raw diary storage.

## Cross-domain transfer

Transfer routes require explicit source and target skills plus relation, evidence, confidence, and provenance. Transfer evaluation is recorded separately from source-domain mastery so success in the source domain is not silently counted as transfer.

## Pedagogical safety

During struggle, direct-answer delivery can be replaced by scaffold-first support. Progressive disclosure, learner agency, source grounding, rights awareness, and no-biometric-inference defaults are enforced by contract.

## Acquisition boundary

V4 is strictly downstream. Learning, graph, evaluation, and multimodal failures cannot block PDF discovery, acquisition, preservation, validation, normalization, rights, or provenance processing.
