# Rechercher Educational Video Engine

## Objective

Build a source-grounded animation pipeline for educational content for children. The video layer is downstream from Rechercher's scholarly source and rights layers.

## Non-negotiable boundary

`Source -> evidence -> script -> storyboard -> media`

Generated video, generated characters, generated voices and generated scenes are derived media. They never become Quran, hadith, tafsir or scholarly evidence.

## Proposed pipeline

1. Select verified source records.
2. Build an evidence bundle with exact source/edition/provenance references.
3. Validate the educational script against the evidence bundle.
4. Adapt language for the target child age without changing the cited meaning.
5. Maintain a character bible so Ahmed and his father remain visually consistent.
6. Produce a storyboard with shot-level prompts and negative constraints.
7. Generate reference character/background images.
8. Generate short shots with the registered video engines.
9. Run shot consistency checks for characters, clothing, setting and chronology.
10. Generate voice and dialogue separately when that produces better Arabic quality.
11. Burn Arabic captions and optional source references.
12. Assemble the shots into the final episode.
13. Run rights, model-license and content-safety gates.
14. Emit a final media manifest containing source IDs, model IDs, model versions, hashes, prompts, voice metadata and derived-media status.

## Engine routing

- Wan2.2 TI2V-5B: default candidate for controlled 720p text/image-to-video shots.
- HunyuanVideo-1.5: quality candidate where its community license and territory conditions permit the intended use.
- LTX-2.x: audio-video candidate; its community license requires a separate deployment/license decision.
- CogVideoX-2B: low-VRAM fallback and experimentation candidate.
- Open-Sora: research/orchestration candidate, not the first production backend.

The orchestrator must benchmark multiple engines on the same shot instead of assuming one engine is universally best.

## Example episode architecture

For an episode such as "أحمد والاستجابة للأذان":

- Scene 1: Ahmed playing; adhan begins; father gently redirects him.
- Scene 2: repeating the adhan and post-adhan supplications.
- Scene 3: wudu and the post-wudu remembrance.
- Scene 4: leaving for the mosque and removing harm from the road.
- Scene 5: mosque entrance and Tahiyyat al-Masjid.
- Scene 6: iqamah and following the imam.

Each scene is split into 4-12 second shots. The shot generator receives only the evidence-approved scene specification, never an unconstrained prompt based on model memory.

## Character consistency

The first production milestone should create reusable reference assets:

- Ahmed, age 7, fixed visual identity.
- Father, fixed visual identity.
- Home interior.
- Wudu area.
- Street.
- Mosque exterior/interior.

No prophet depiction is required. Religious figures that should not be depicted are represented by environment, text, light, objects or narration as appropriate.

## Arabic-first requirements

- Arabic script remains human/source controlled.
- Dialogue is generated from the approved script, not invented by the video model.
- Qur'an and hadith quotations are immutable source text after verification.
- Captions are derived from the approved dialogue.
- Translation is a separate source-controlled layer.

## First benchmark

Use the same 5-second shot prompts across Wan2.2 TI2V-5B, HunyuanVideo-1.5 and CogVideoX-2B. Record:

- visual coherence
- character consistency
- motion quality
- Arabic prompt adherence
- generation time
- peak VRAM
- output hash
- license status
- reproducibility

Then route each shot type to the engine that satisfies the project constraints.

## Free-compute principle

The registry records software/model availability separately from compute availability. GitHub is source/control-plane infrastructure, not a free GPU. GPU execution should use an available free/authorized environment such as the user's Kaggle allocation when compatible, and the system must not assume a paid API.
