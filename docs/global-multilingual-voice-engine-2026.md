# Global Multilingual Voice Engine — 2026

This layer defines how Din Allah Encyclopedia selects, generates, validates and records narration audio for every language.

## Non-negotiable rule

A generated voice is not accepted merely because a WAV/MP3 file was produced. It must be understandable to a native listener, correctly pronounced, naturally paced, appropriately expressive, legally usable, and reproducible from recorded provenance.

## Engine pool

- **Chatterbox Multilingual V3** — primary multilingual route for its supported languages, including Arabic; use language-matched reference audio and apply the model's language/voice guidance.
- **Qwen3-TTS** — multilingual/custom-voice route; use only for languages/checkpoints that pass our quality and rights gates.
- **Piper** — offline/local fallback; voice licenses are checked individually.
- **MMS-TTS** — very broad low-resource coverage, but CC BY-NC-4.0 is a hard license gate.
- **SeamlessM4T v2** — translation/bridging route; its model license is CC BY-NC-4.0, so it is not an unrestricted production default.

## Speech control

The narration layer uses SSML-compatible controls for rate, pitch, volume, emphasis and semantic pauses, plus a pronunciation-lexicon layer for proper names and specialist terminology.

Punctuation is treated as text structure, not as something the narrator should read aloud.

## Arabic

Arabic receives a dedicated quality gate for Modern Standard Arabic narration. A non-Arabic reference speaker must never be used in a way that imports a foreign accent into Arabic. Quranic recitation is never synthesized by the narrator engine.

## Quranic recitation

Quranic text and explanatory narration are separate media classes. Recitation enters production only through a verified reciter/source record with rights/provenance. The explanatory narrator does not recite Quranic verses.

## All languages

The same gates apply to every language:

1. language identification
2. native-language intelligibility
3. pronunciation
4. prosody and pauses
5. semantic emphasis
6. voice/asset license
7. model/checkpoint license
8. audio QA
9. provenance record
10. publish only after passing all gates

If no engine reaches the threshold, the system falls back to a human-verified recording rather than publishing poor synthetic speech.

## Provenance

Every published narration records engine, version, checkpoint, voice, language, voice license, text/SSML hashes, pronunciation lexicon version, generation timestamp and QA result.
