# Engine-to-Engine Dialogue — 2026

## Identity

The two named internal engines are **Al-Huda — الهُدَى** and **Al-Taqwa — الْتَقْوَى**.

## Religious and scholarly scope

The dialogue defaults to the Din Allah religious/scholarly domain. Substantive claims must be grounded in the Din Allah Corpus and/or verified search, with provenance and source records attached to turns. Allowed domains include Quran and tafsir, hadith, aqidah, fiqh, sirah, Islamic history, Arabic/linguistics, and Islamic scholarly studies.

## Speech + writing

The user may start the dialogue by voice or text. The engine exchange is retained as a complete written transcript. Speech output is optional and user-controlled. Sources and citations remain written by default and do not need to be spoken aloud.

## Copy/export

The user can copy the complete engine-to-engine dialogue, including user turns, every engine turn, source/provenance records, and timestamps. No turn is silently omitted.

## Architecture

User → Al-Huda → structured message → Al-Taqwa → structured message → Al-Huda ...

Generated engine audio is never fed back through the physical microphone.

## Completion

Hard turn limits, loop detection, per-turn timeouts, immediate user stop, microphone isolation, and provenance are required. Configuration alone does not prove completion; end-to-end runtime tests remain mandatory.

## Quran and Harmony

Quran recitation remains a separate original/rights-cleared audio path. Synthetic TTS is never treated as Quran recitation. Harmony Speech Engine remains an optional serving/orchestration component and is distinct from Huawei HarmonyOS.
