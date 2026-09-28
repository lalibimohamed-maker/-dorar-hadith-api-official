# Rechercher Learning Intelligence v4 — 2026

V4 extends the existing learning intelligence layer without replacing V3.

## Memory

Session memory stores transient events and a bounded feedback buffer. Before durable persistence, session signals are summarized into a compact session record. Long-term memory stores summaries rather than raw session events or raw feedback by default.

## Evidence-grounded adaptation

Verified Corpus, provenance, rights and scholarly evidence remain authoritative. The learner model can influence sequence, modality, scaffolding and practice selection, but it cannot alter source identity or evidentiary status.

## Transfer

Cross-domain transfer is represented explicitly as a route from source skill to target skill. Evidence supporting both ends is recorded; insufficient support yields `needs_review`.

## Retrieval preservation

When the learner has already invested retrieval effort and the pedagogical policy says to preserve it, a requested direct answer can be converted to `guided-retrieval-first` rather than immediately revealing the answer.

## Pedagogical safety

Unsupported generated claims are not evidence. Uncertainty must remain explicit, and requests for autonomous religious authority are rejected. Human review remains available where scholarly judgment is required.

## Acquisition boundary

Learning Intelligence V4 is downstream from PDF acquisition. Learning errors, missing educational metadata, transfer failures or pedagogical safety failures never block acquisition persistence.
