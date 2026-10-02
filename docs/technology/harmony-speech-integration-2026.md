# Harmony Speech integration — 2026

Harmony Speech Engine is on the Rechercher radar as a speech serving/orchestration layer, not as a replacement for the Din Allah voice core.

## Roles

- Unified local/self-hosted API for speech model routing.
- GPU/CPU execution and multi-model serving.
- Candidate integrations include Faster-Whisper, Silero VAD, SenseVoice and multiple TTS/voice-conversion systems.
- Harmony remains behind provenance, license, runtime-proof and benchmark gates.

## Acquisition rule

Harmony runtime code may be acquired separately from model weights. Third-party weights are never treated as redistributable merely because Harmony can load them.

## Voice profiles

Speaker enrollment/identification is optional. The system supports one, two, three, or group profiles and an open-microphone mode without speaker identification. Speaker embeddings are preferred over retaining raw recordings.

## Wake phrase

The default display name is "يا بوابة العلم", but the user can choose a shorter phrase in settings. The selected phrase is platform-specific and must be verified for false accepts/rejects before production.

## Quran

Quran recitation remains a separate original/rights-cleared audio asset path. Synthetic TTS is not used as Quran recitation.
