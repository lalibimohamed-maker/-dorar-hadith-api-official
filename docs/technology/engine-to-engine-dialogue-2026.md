# Engine-to-Engine Dialogue — 2026

## Purpose

«حوار المحركات» is a separate capability inside the **يا بوابة العلم** voice system. It allows two or more internal engines to exchange bounded structured messages.

This is intentionally **not** implemented as a microphone feedback loop.

## Architecture

`User → يا بوابة العلم → Engine A → structured message → Engine B → structured message → response`

When speech output is needed, the selected TTS engine renders the final response for the user. Engine B's audio is not fed back into the physical microphone.

## Why structured messages

Using text/JSON between engines avoids acoustic feedback, wake-word reactivation, room noise, echo, and uncontrolled self-conversation. It also gives every turn a stable provenance record.

Required fields include:

- conversation ID
- turn ID
- engine ID
- role
- content
- language
- confidence
- timestamp
- provenance

## Modes

### Human-supervised

The user explicitly starts the exchange, can stop it immediately, and can inspect the dialogue.

### Autonomous

Optional bounded engine-to-engine discussion. It requires explicit user enablement and a hard turn limit.

## Safety controls

Every implementation must include:

- hard maximum turns;
- loop/repetition detection;
- duplicate-response suppression;
- per-turn timeout;
- immediate user stop;
- microphone isolation during internal dialogue;
- no privilege escalation from one engine to another;
- human confirmation for sensitive actions.

## Multi-speaker behavior

One, two, three, group, and open-microphone profiles remain separate from engine-to-engine dialogue.

Two or three **speaker profiles do not by themselves mean simultaneous multi-speaker recognition**. Concurrent speech requires a runtime-verified diarization and turn-taking path.

## Harmony

Harmony Speech Engine may participate as an optional serving/orchestration engine. It is not HarmonyOS and it does not replace the Din Allah voice core.

## Quran

Quran recitation remains a separate original/rights-cleared audio path. Synthetic TTS is never treated as Quran recitation.

## Completion gate

Configuration alone does not close the feature gap. The feature is complete only after end-to-end runtime tests demonstrate bounded two-engine exchange, interruption, loop prevention, microphone isolation, provenance, and correct termination.
