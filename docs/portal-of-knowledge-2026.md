# بوابة العلم — Portal of Knowledge

## What is now implemented

The repository now has a unified capability contract at `config/portal-of-knowledge-2026.json` and a runtime reader in `src/knowledge-portal.js`.

The portal treats the encyclopedia as one connected knowledge surface while keeping these layers distinct:

- Quran text
- translations
- word-by-word study
- tafsir
- reflections and related verses
- recitations and Mushaf resources
- Hadith corpus and narrator methodology
- Tafsir/Sirah/Fiqh/research books and scholars
- Tajweed and learning tools
- prayer-time, Qibla, Hijri and mosque-provider integration points
- manuscript images, audio, video and OCR
- provenance, verification and rights state

## Evidence-driven external integrations

Quran.com launched Study Mode in January 2026 with word-level pronunciation/details, Tafsir, reflections and related verses. The portal therefore exposes those as separate study capabilities rather than mixing them into Quran text.

Quran Foundation currently documents Content APIs for chapters, verses, translations, Tafsir, audio, recitations, pages, Juz/Hizb/Ruku/Manzil and content synchronization for Mushafs, translations, word-by-word translations, Tafsir, recitations and articles.

Tanzil explicitly permits verbatim redistribution of its Quran text with attribution and a source link, while forbidding changes to the text. The existing acquisition pipeline already materializes that text under `data/corpus/quran/`.

The Met Open Access collection explicitly marks public-domain images as available for unrestricted commercial and noncommercial use; the acquisition pipeline uses the public-domain flag before downloading Quran manuscript images.

## Rights model

A download button is not itself treated as a license. The portal distinguishes `public-domain`, `waqf-explicit`, `verified`, `rights-restricted`, `external-link-only` and `needs-review` states. This permits the encyclopedia to remain useful even when a work must be linked rather than mirrored.

## Existing API entry points

The current API already exposes `/quran/ayah`, `/quran/translations`, `/search`, `/books`, `/authors`, `/research/domains`, `/research/scholars`, `/fiqh`, `/fiqh/research`, `/tajweed` and Hadith research routes. The new portal contract provides the common discovery layer over those routes and marks provider-backed capabilities that require external credentials or device/location context.

## Verification

`test/knowledge-portal.test.js` verifies the seven major capability domains, the separation of Quran study layers, and the mandatory provenance fields.
