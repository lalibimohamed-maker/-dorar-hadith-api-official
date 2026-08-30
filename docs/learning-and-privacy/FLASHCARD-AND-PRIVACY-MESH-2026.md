# FlashCard + Privacy/Security Mesh — 2026

## Learning engine

The encyclopedia uses a free-first interactive question contract. It supports flashcard recall, single/multiple choice, matching, drag-and-drop, fill-in-the-blank, true/false, ordering, image pairing, memory games, short answers, spoken answers, interactive-video questions, and branching scenarios.

H5P Flashcards, Question Set, MultiChoice, DragQuestion, Blanks, MemoryGame and SpeakTheWords are tracked as optional adapters. Their upstream repositories currently publish MIT licenses for these libraries. H5P documents multiple-choice, fill-in-the-blank, drag-and-drop, adaptive video questions and speech-answer activities.

Voice questions use the device/browser speech layer where available. `SpeechSynthesis` supplies available device voices, while speech recognition remains optional because browser support varies.

Religious answers remain source-bound: a generated answer is never authoritative merely because it was generated. Source ID, canonical answer and review status are required.

## Defensive privacy/security

The privacy mesh is defensive only. It does not claim to detect every OS-level or hardware-level spyware implementation.

Camera/microphone: explicit permission, active user session, no silent/background capture, and session-scoped access where the platform allows it.

Bluetooth: non-discoverable by default, explicit pairing/approval, unexpected-device change detection, and no unnecessary logging of stable identifiers.

Anti-spam: token-bucket rate limits, burst control, duplicate detection, abuse scoring, progressive cooldown and a human-check escalation path when risk rises.

Executable/media security: malware scanning, YARA/rule scanning, dependency auditing and static analysis remain fail-closed. Unknown executable inputs are blocked.

These controls are designed to work locally without requiring a paid API or paid subscription.
