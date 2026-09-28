# موسوعة الدرر — architecture

## Vision
A public, calm, multilingual discovery layer for Quran, Quran sciences, hadith, seerah, fiqh and scholarly books. The project does not claim to replace source authorities.

## Source hierarchy
- Primary hadith source: Dorar.net official service.
- Quran reading: QuranFlash link/integration subject to its terms.
- Tafsir: Tafsir.app and other licensed/approved sources.
- Tadabbur: altadabbur.com and Tadabur.app as secondary sources.
- Quran guidance: Muslim Library link as a secondary source.
- Books: Shamela as a secondary discovery/reference source.
- Hadith corpus: Bukhari, Muslim, combined collections, Ahmad, Abu Ya'la, Ishaq ibn Rahawayh, Bayhaqi, Abu Dawud, Ibn Majah, Tirmidhi, Nasa'i and Darimi, subject to rights and data availability.
- Seerah: Ibn Hisham, Imta' al-Asma', Maghazi, al-Raheeq al-Makhtum, Rawdat al-Anwar, al-Shifa, al-Shama'il, Dala'il al-Nubuwwa, Zad al-Ma'ad, Uyun al-Athar, Subul al-Huda, al-Tabaqat and other verified references.

## Quran reader
Interactive word highlighting requires trustworthy word-level audio timestamps. If only ayah timestamps exist, highlight the ayah rather than inventing word timing. Word/ayah taps open tafsir, revelation context and related material where available.

## سياق نزول الآية
This is a distinct feature: connect a documented event preceding revelation to the ayah and show the narration, source and reliability. Similarity alone is never treated as a proven cause of revelation.

## Audio and offline
Downloads are local-device cache, not server-side redistribution. Full Quran, surah and ayah-range downloads are enabled only for audio sources that permit offline use. Never redistribute protected audio without permission.

## Fiqh
Support the four madhhabs (Hanafi, Maliki, Shafi'i, Hanbali) as attributed comparative views. The application is not an automated mufti.

## Agent and RAG architecture
The assistant is an evidence-grounded response layer above the existing Corpus and search system. Its execution path is:

```text
User question
  -> Intent Router
  -> Existing Unified Search / domain tools
  -> Evidence normalization
  -> Hybrid retrieval (lexical + semantic)
  -> Reranking
  -> Bounded Evidence Context
  -> Interchangeable model provider
  -> Claim/Citation Verification
  -> Answer or evidence-insufficiency response
```

The agent does not replace `unified-search.js`. Existing search modules remain the source-selection layer for hadith, Quran, fiqh, rijal, scholars, historical research and other indexed domains.

### Model boundary
The model is a formulation and explanation component, not an authority layer. It must not independently decide:
- hadith authenticity;
- narrator grading;
- fiqh attribution or madhhab position;
- Quran wording;
- scholarly attribution;
- source reliability.

Those properties must be inherited from cited evidence and its metadata.

The runtime supports local inference through `node-llama-cpp` with explicit local model paths and checksums. A provider interface keeps the generation layer replaceable without changing Corpus data or search contracts. No model or weight is downloaded automatically at runtime.

### Evidence contract
Evidence passed to the model should retain, when available:
- stable identifier;
- original text or exact excerpt;
- language;
- work/title;
- author;
- edition/volume/chapter/page or other locator;
- source URL or reference;
- verification status;
- rights/reuse status;
- hadith-specific narrator, critic/scholar, grading and takhrij metadata.

For Quran content, the canonical Arabic text remains distinct from translations and generated explanations. For hadith, text, variants, grading and source attribution remain distinct fields.

### Response verification
Generated responses are checked after generation. The verifier rejects empty answers, unknown citation identifiers, answers without evidence when evidence is required, and explicitly supplied claims that have no citation. A structurally verified answer is still an interpreted/generated layer; verification of citation structure does not itself prove the underlying scholarly claim.

When the evidence set is insufficient, the agent must not fill the gap from model memory. It returns an evidence-insufficiency response instead.

## Corpus boundary
The AI layer is downstream from the verified Corpus and acquisition system.

```text
Corpus / Acquisition
        |
        v
   Search + Evidence
        |
        v
      AI/RAG
        |
        v
  Generated response
```

Generated text never becomes canonical Corpus content automatically. The agent cannot rewrite, normalize, delete, or replace canonical Quran, hadith or scholarly source text. Learning Intelligence remains downstream of acquisition and cannot block acquisition.

## Tool boundary
Agent tools are explicit, inspectable functions. Tool calls may search existing sources and evidence indexes; they may not silently promote a discovery record into scholarly authority. Source attribution, provenance and rights metadata must survive every transformation.

## Memory and learning
Persistent personal memory is not part of the first agent runtime. Any future learner-memory layer requires consent, purpose limitation, explicit retention rules, separation from Corpus data and independent privacy controls. Pedagogical adaptation remains separate from canonical religious content.

## Safety and attribution
Every result must retain source name and URL. Reliability labels must distinguish primary text, scholarly quotation, historical report and AI-generated summary. AI must never fabricate hadith, ayah, attribution or grading.

## Localization
Arabic first, English second, then French, Turkish, Chinese, Korean, Polish, Spanish, Portuguese, German, Italian, Russian and Hindi. Detect device language, allow manual override, persist choice and switch RTL/LTR automatically.

## Book Cache Governance
The Book Cache is a technical layer, not an authority layer. A book may enter cache only after source identity/URL, provenance identity with a valid verification timestamp, an explicitly allowed redistribution-rights state, and successful validation are all present. Discovery alone never proves redistribution rights. The cache policy fails closed when any gate is missing or uncertain.

For AI/RAG, cached book material remains source-attributed evidence only. Rights, provenance, verification and location metadata travel with the evidence; cached or generated wording never becomes canonical Corpus content.

## Integrated Knowledge Graph
The encyclopedia uses one source-aware graph contract across Quran, hadith, tafsir, asbab al-nuzul, sirah/context, narrators/rijal, hadith criticism, explanations, fiqh, aqeedah, benefits, scholar statements, fatwa and books. Node and edge provenance is mandatory. Trusted evidence traversal requires a trusted verification state and attached rights metadata.

Evidence layers are explicit: primary text, scholarly interpretation, metadata, source-backed relations, and generated assistance. Generated assistance can explain retrieved evidence but cannot become evidence. Materially different hadith variants remain separate nodes, and conflicting scholarly judgments remain separate attributed records.

Graph traversal is bidirectional for retrieval. Search ranking remains a retrieval signal only and never a religious judgment.


## Digital Book Processing Pipeline
The downloadable version of a book is a derived digital edition, not an unmodified assumption about a web search result. The source reference remains immutable and identifiable by `sourceSha256`.

Contract sequence: `Search → Source → Provenance → Rights → Fetch → Immutable Source → Multi-OCR → Alignment → Validation → Digital Master → PDF/DOCX/EPUB/PPTX`.

At least two explicitly independent OCR engines are required before alignment can proceed to Digital Master. OCR is derivative evidence; the source/image remains authoritative. Alignment must carry the source fingerprint, unresolved differences block Digital Master, and validation must be `valid` before promotion.

Restricted, read-only, link-only, read-copy and rights-unclear items remain reference-only and cannot enter redistribution export. Bulk requests are planned from catalog editions with deduplication and per-edition rights checks; blocked works retain source references rather than copied content. Presentation themes are read-only overlays and do not mutate the underlying text layer.


The integrated graph also carries passage/page/claim/uncertainty records and learning-layer structures such as misconceptions, learning activities and assessments. Prerequisite and misconception relations remain explicit graph edges with their own provenance; learner adaptation consumes them downstream and does not write back into canonical Corpus text.
