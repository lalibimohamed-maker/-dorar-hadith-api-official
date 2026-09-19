# Rechercher — Multilingual Islamic Resource Expansion

This layer expands the multilingual source network beyond the initial 23-language phase.

## Verified discovery basis

QuranEnc exposes an API for listing translation resources by ISO language and endpoints for surah/ayah translation retrieval. Its public catalogue currently documents 100+ translations across 80+ languages and includes resources such as Albanian, Azerbaijani, Bosnian, Croatian, Georgian, Greek, Kazakh, Korean, Lithuanian, Macedonian, Serbian, Ukrainian, Uzbek, Vietnamese, Bengali, Malayalam, Somali, Swahili, Fulani and Lingala.

Quran Foundation provides Content APIs for Quran text, verses, translations and tafsir, plus Content Sync for maintaining local copies of approved public resources. The Rechercher adapter keeps credentials outside the repository.

## Runtime rule

For each language, Rechercher projects the language across every configured Islamic knowledge domain. No fixed language ceiling is used.

Each cell follows:

`primary/institutional → API → corpus → structured web → scholarly dataset → translation metadata → provenance → rights → verification`

Missing verified translations remain queued as `translation-needed`. Machine translation, if ever generated, remains separately labelled `machine-translated` and `unverified`.

## Corpus boundary

`canonical_arabic_quran != human_translation != machine_translation`

The registry is a system-layer discovery structure. It does not overwrite canonical Arabic text, does not silently copy copyrighted works, and does not replace the existing PDF acquisition engine.
