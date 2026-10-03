# Rechercher — Learning Gap Register 2026

This register turns the global research into implementation targets rather than a documentation-only exercise.

| Priority | Gap | Required capability | Current state | Acquisition blocker? |
|---|---|---|---|---|
| P0 | Unified scheduler | FSRS-compatible interface + SM-2/Leitner fallbacks | Partial — adapter contract exists; native FSRS/SM-2/Leitner backends are not yet wired as production schedulers | No |
| P0 | Central selector | Choose item/mode/source/difficulty and explain why | Implemented — learning engine selects method/item with inspectable reasons | No |
| P0 | Confidence calibration | Store confidence separately from correctness | Implemented — confidence is separate and V3 calibration records calibration error/bias | No |
| P0 | Provenance lifecycle | Source/page anchor + card lifecycle + invalidation | Partial — source/provenance fields are preserved, but full card invalidation lifecycle is not yet centralized | No |
| P1 | Prerequisites | Route failures to prerequisite concepts | Implemented — V3 prerequisite graph and gap diagnosis are executable | No |
| P1 | Interleaving | Mix discriminable concepts intentionally | Missing — no dedicated interleaving policy/executor is currently established | No |
| P1 | Transfer | Generate verified-evidence application tasks | Partial — V3/V4 transfer graph and evaluation exist; broader task generation remains to be implemented | No |
| P1 | Misconceptions | Detect repeated error patterns and remediate | Partial — misconception graph/diagnosis exists; longitudinal remediation policy remains incomplete | No |
| P1 | Progressive explanation | Control answer depth without losing evidence | Partial — progressive disclosure is a V4 safety policy; a complete answer-depth controller is not yet implemented | No |
| P1 | Delayed mastery | Require delayed/transfer evidence before mastery | Partial — delayed/transfer evaluation is represented, but a full mastery gate over delayed evidence is not yet centralized | No |
| P2 | Game adapters | Memory, matching, ordering, hotspots, timelines, branching | Partial — game is represented as a practice mode; dedicated adapters are still required | No |
| P2 | Game telemetry | Map game events to skills and retrieval evidence | Partial — generic feedback signals exist; game-specific event mapping is not yet complete | No |
| P2 | Cooperative learning | Teach-back, source hunts, peer/team challenges | Missing — no cooperative-learning runtime is established | No |
| P3 | Multimodal | Audio, spoken answer, video, diagram and manuscript interaction | Partial — multimodal/voice infrastructure exists elsewhere in the project; learning-specific orchestration remains incomplete | No |
| P3 | Offline queue | Local review packs and safe synchronization | Missing — no dedicated offline learning queue/sync contract is established | No |
| P4 | Method evaluation | Compare algorithms using retention/transfer outcomes | Implemented — V3 records immediate/delayed/transfer outcomes and evaluates methods | No |
| P4 | Research registry | Continuously update learning-method evidence | Partial — policy/configuration and outcome registry structures exist; continuous evidence refresh is still required | No |

## Current implementation boundary

The executable learning layers currently include V1 learning decisions, V3 knowledge/evidence/prerequisite/misconception/learner graphs and calibration, and V4 session/long-term learner state, cross-domain transfer and pedagogical safety.

The local RAG agent is a separate downstream response layer. It may provide source-grounded explanations for learning content, but it does not become the learning system itself and it cannot promote generated text into the Corpus.

## Non-negotiable rule

No gap in this register may be implemented as a prerequisite for PDF acquisition. Rechercher must continue discovering, downloading, preserving and validating books independently of learning enrichment. Learning remains downstream of acquisition and must never block acquisition.
