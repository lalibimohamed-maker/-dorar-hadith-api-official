# Rechercher — Global Deep Research: Flashcards, Learning Games, Adaptive Learning & Educational Apps

## Executive conclusion

The current encyclopedia already has a strong interactive-learning foundation, but the research identifies a missing **learning orchestration layer** above the existing question modes and flashcard engine. The target should not be to copy one commercial application. It should combine the strongest evidence-informed mechanisms into a source-grounded, free-first, multilingual learning system while keeping corpus acquisition independent and non-blocking.

## Algorithm families to support

### Flashcard scheduling
- **SM-2 / SuperMemo family** — compatibility/reference scheduler, not the sole modern default.
- **FSRS family** — preferred modern spaced-repetition scheduler; model retrievability/stability and optimize parameters from review history.
- **Leitner boxes** — explainable offline fallback and game mechanic.
- **Forgetting-curve / half-life models** — interpretable retention and schedule views.
- **Deadline-aware scheduling** — alter review policy around a target date.
- **Difficulty-aware scheduling** — separate item difficulty from learner memory strength.
- **Multi-deck optimization** — permit separate parameters for materially different content contexts.

### Question selection
Use a multi-objective selector rather than random cards: due/retrievability risk, recent errors, low mastery, prerequisite importance, confidence mismatch, novelty, interleaving value, transfer value, source diversity, and learner time budget.

### Knowledge tracing
Use an implementation ladder: explainable rules first; Bayesian Knowledge Tracing where skills are well defined; IRT-style item models when item banks are large enough; contextual/deep knowledge tracing only when data volume and governance justify it. Interpretability is especially important for religious scholarship.

## Retrieval modes to make first-class

Free recall; recognition; cued recall; cloze; short answer; multi-step explanation; source-location recall; quote-to-source matching; concept-to-evidence matching; compare/contrast; classification; chronology; error correction; confidence prediction; teach-back; transfer to a new case; source criticism/provenance reasoning; contradiction resolution; audio/spoken retrieval; image/diagram retrieval.

## Learning-game families

High-value: memory/pair matching, timed recall, ordering, drag-and-drop classification, image hotspots, timeline race, source matching, scholar/position matching, tafsir comparison, narrator relationship challenge, madhhab comparison, evidence hunt, error detection, progressive clue ladder, branching scenario, case-based decision game, and cooperative challenges.

Advanced: dynamic difficulty adjustment, adaptive branching, mastery-gated progression, quest/path systems, spaced game reviews, procedural question generation from approved evidence, multiplayer/cooperative review, and teacher/mentor challenge creation.

Game mechanics should reward demonstrated learning effort and mastery rather than app presence, streak length, or excessive session time.

## What the worldwide application landscape reveals

### Anki / FSRS
Anki combines active recall and spaced repetition and supports FSRS alongside legacy SM-2. Its documentation describes parameter optimization from review history and warns against blindly copying parameters between different learning contexts. Rechercher should therefore store scheduler state per learner/content context and expose an explainable schedule.

### Quizlet
Quizlet's adaptive learning varies question type, difficulty and frequency and has used large-scale anonymous study-session data. Its 2026 direction adds scheduled review, retention insights, puzzle-style engagement and study-with-friends. Rechercher should borrow the design pattern—adaptive modality + retention visibility + social accountability—without depending on a proprietary service.

### Duolingo
Duolingo combines interactive lessons, personalization, game-like progression and spaced review. Rechercher can borrow visible learning paths and lightweight frequent practice while preventing streaks from becoming the learning objective.

### Khan Academy
Khan Academy demonstrates explicit mastery states, course/unit mastery and mixed-skill challenges. Rechercher should add a source-grounded mastery map for concepts, books, disciplines and prerequisite skills.

### H5P / Moodle
H5P provides an open interactive-content vocabulary including flashcards, memory games, image hotspots, interactive video, branching scenarios, timelines, drag-and-drop, dictation, speech activities and question sets. Moodle integrates these content types. Rechercher should use reusable open adapters instead of rebuilding every interaction from zero.

### Kahoot and classroom game systems
Kahoot demonstrates immediate feedback, solo/group play and social engagement. Its 2026 language-learning offering combines visual flashcards, mini-games and spaced repetition. Rechercher should support optional social/cooperative modes but keep the default scholarly experience calm and non-competitive.

## Hidden gaps discovered for Rechercher

1. **Unified scheduler contract** — the current configuration enables spaced review but lacks a full scheduler abstraction for FSRS/SM-2/Leitner/deadline modes, migration, evaluation and per-context optimization.
2. **Central item-selection policy** — the system needs one decision layer answering which question, source, difficulty, objective and timing should be selected and why.
3. **Confidence calibration loop** — correctness and confidence must be separate signals.
4. **Prerequisite-aware routing** — repeated failure should sometimes route to a prerequisite rather than repeat the same card.
5. **Transfer layer** — move from memorization to application, comparison, evidence analysis and novel cases.
6. **Source-grounded card generation** — verified passage/page anchors, immutable source IDs, answer provenance and regeneration history.
7. **Card quality lifecycle** — draft → machine-generated → source-verified → scholar-reviewed → published → deprecated; source changes should trigger review.
8. **Misconception model** — repeated errors should produce targeted remediation instead of infinite repetition.
9. **Progressive explanation depth** — one-line answer → concise explanation → evidence → scholarly positions → source reading.
10. **Game-to-learning bridge** — game events must map to skills/items and generate meaningful retrieval/feedback evidence.
11. **Cooperative learning** — peer/team challenges, teach-back, source debates and evidence hunts; public leaderboards should not be the default.
12. **Accessibility/modality equivalence** — keyboard, touch, screen-reader, text/audio and low-bandwidth alternatives.
13. **Offline-first review queue** — downloadable approved decks/paths, offline review, safe synchronization and no loss of history.
14. **Learning analytics** — delayed retention, transfer, error correction, confidence calibration, source comprehension and teach-back quality; not clicks or minutes alone.

## Recommended architecture

```text
Verified Corpus
  ↓
Source / Passage / Claim / Concept graph
  ↓
Learning-object generator
  ↓
Card + Question + Game item registry
  ↓
Learner model
  ├─ mastery
  ├─ retrievability
  ├─ stability
  ├─ prerequisites
  ├─ misconceptions
  ├─ confidence calibration
  └─ recent context
  ↓
Learning Orchestrator
  ├─ scheduler
  ├─ item selector
  ├─ difficulty controller
  ├─ interleaver
  ├─ modality selector
  ├─ transfer selector
  └─ game adapter
  ↓
Practice / Game / Reading / Audio / Visual
  ↓
Feedback + Evidence + Reflection
  ↓
Delayed assessment
  ↓
Model update
```

The corpus remains authoritative infrastructure. The learning layer consumes it and never rewrites canonical sources.

## Proposed scheduler decision contract

```json
{
  "itemId": "...",
  "skillIds": ["..."],
  "sourceIds": ["..."],
  "mode": "free-recall",
  "reason": ["due", "low-retrievability", "prerequisite-gap"],
  "predictedRetrievability": 0.81,
  "targetDifficulty": "medium",
  "nextReview": "...",
  "confidencePrompt": true,
  "transferAfter": true
}
```

This keeps algorithms replaceable and testable.

## Research-backed design rules

1. Retrieval should be active rather than passive rereading.
2. Spacing is useful but its effect is not identical across every domain; scheduling must remain empirically testable.
3. Feedback should explain errors, not merely mark them wrong.
4. Worked examples are especially useful for initial acquisition and complex skills.
5. Self-explanation can strengthen understanding, particularly when matched to prior knowledge.
6. Interleaving should mix discriminable concepts rather than create arbitrary difficulty.
7. Games must serve explicit learning objectives; engagement alone is not evidence of learning.
8. Adaptive systems should change selection, difficulty or path—not merely decorate the interface with points.
9. Confidence should be measured separately from correctness.
10. Delayed tests and transfer tasks are needed before declaring mastery.
11. Religious answers require source verification and scholarly safeguards.
12. Learning enrichment must never block PDF acquisition.

## Priority roadmap

### P0 — foundation
- Scheduler interface with FSRS-compatible implementation + simple Leitner fallback.
- Central item selector.
- Skill/mastery state.
- Confidence + correctness logging.
- Source/page provenance on every item.
- Card lifecycle and invalidation.

### P1 — major learning gains
- Prerequisite graph routing.
- Interleaving engine.
- Difficulty adaptation.
- Transfer-question generator from verified evidence.
- Misconception/remediation routing.
- Progressive explanation depth.

### P2 — games
- Memory, matching, ordering, hotspot, timeline, source hunt, evidence chain, branching scenarios.
- Game events mapped to learning objectives.
- Cooperative mode.
- Optional safe rewards.

### P3 — multimodal intelligence
- Audio retrieval.
- Spoken answers with explicit permissions.
- Interactive video questions.
- Diagram/graph retrieval.
- Manuscript/image hotspots.
- Offline review packs.

### P4 — research intelligence
- Continuously updated learning-method registry.
- Controlled evaluations where appropriate.
- Method-effect dashboards.
- Algorithm comparison on consented/local learning data.
- Scholar review of high-stakes religious learning objects.

## Guardrails

- No paid API is required for core functionality.
- No proprietary app becomes a corpus dependency.
- No unrelated learner profiling.
- No public leaderboard is required for mastery.
- No machine-generated religious answer becomes authoritative without verified evidence and appropriate scholarly review.
- No educational feature may stop or delay Rechercher PDF acquisition.
- Canonical Quran Arabic remains unchanged.

## Sources

- Anki Manual — FSRS and scheduling: https://docs.ankiweb.net/deck-options
- Anki Manual — active recall/spaced repetition: https://docs.ankiweb.net/background.html
- Quizlet — adaptive Learn: https://quizlet.com/blog/introducing-the-new-quizlet-learn
- Quizlet — 2026 product direction: https://quizlet.com/blog/built-for-better-learning-whats-new-on-quizlet-this-fall
- Duolingo — spaced repetition: https://blog.duolingo.com/spaced-repetition-for-learning/
- Duolingo — teaching method: https://blog.duolingo.com/duolingo-teaching-method/
- Khan Academy — mastery system: https://support.khanacademy.org/hc/en-us/articles/115002552631-What-are-Course-and-Unit-Mastery
- H5P — content types: https://h5p.org/content-types-and-applications
- Moodle — H5P: https://docs.moodle.org/500/en/H5P
- Kahoot — learning games: https://kahoot.com/
- Hong, Saab & Admiraal (2024), Computers & Education: https://doi.org/10.1016/j.compedu.2024.105000
- Triantafyllou, Georgiadis & Sapounidis (2025), International Review of Education: https://doi.org/10.1007/s11159-024-10111-8
- Bego et al. (2024), International Journal of STEM Education: https://doi.org/10.1186/s40594-024-00468-5
- Trumble et al. (2024), Advances in Health Sciences Education: https://doi.org/10.1007/s10459-023-10274-3
- Brummer et al. (2024), Learning Environments Research: https://doi.org/10.1007/s10984-024-09501-4
- Murray, Horner & Göbel, meta-analysis of spacing/retrieval in mathematics: https://pure.york.ac.uk/portal/en/publications/a-meta-analytic-review-of-the-effectiveness-of-spacing-and-retrie/

## Definition of done

A learning event should be traceable from source → learning object → algorithmic selection reason → learner response → feedback → scheduled follow-up → delayed/transfer assessment, while every religious claim remains traceable to verified evidence and none of these learning operations can block corpus acquisition.
