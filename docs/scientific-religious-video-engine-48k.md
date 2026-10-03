# Scientific-Religious Video Engine — 48K Render Blueprint

This registry describes an original-video creation pipeline for Din Allah Encyclopedia. It is a design/evaluation layer only: no runtime dependency, no canonical Corpus mutation, and no automatic promotion of models or media.

## Intended behavior

A browser question becomes an evidence-backed documentary plan rather than a link to a random high-resolution video. The plan can combine original generated scenes, lawfully reusable footage, scientific figures, Quran references, verified hadith references, scholarly context, multilingual meaning translations, narration/recitation, and synchronized overlays.

Every scene is attached to a claim/evidence record. A third-party video found by search is never treated as reusable merely because it is public on the internet. It is reference-only until the media-rights gate records a compatible license or explicit permission.

## Religious and scientific integrity

The engine separates:

- Quran Arabic text
- translation of meanings
- tafsir/exegesis
- hadith text and grading
- scientific observation
- scientific consensus
- scientific hypothesis
- historical report
- interpretive relationship

It must not silently turn an interpretive relationship into a scientific fact or a religious ruling.

For example, a question about bees, ants, mountains, rivers, plants or animals should generate a research-backed sequence in which each scientific statement is sourced and then related to Quran/hadith material only to the degree supported by the evidence.

## Original creation first

When suitable licensed footage is unavailable, the preferred path is original scene generation: scientific visualization, 3D explanatory scenes, maps, diagrams, animations, simulations and other newly generated visuals. Generative models are candidate engines, not automatically approved dependencies.

Current candidate examples include Wan2.1, LTX-2.x and HunyuanVideo. Their licensing is tracked independently because model licensing can contain territory, commercial-use, dataset or community-license conditions.

## Word-synchronized Quran layer

A rights-cleared recitation is aligned to words/characters. The timing manifest drives word highlighting, pronunciation-linked animation, translation timing and accessibility captions. The Quran text itself remains verbatim; translation layers remain distinct assets.

## 48K output architecture

The renderer supports output profiles up to a 48K-class landscape ceiling of 46080x25920 and a portrait ceiling of 25920x46080. The pipeline is multi-stage:

1. evidence and storyboard
2. generation or lawful media acquisition
3. scene analysis
4. composition
5. Quran/hadith/translation/audio synchronization
6. text/vector rendering at target resolution
7. restoration/upscaling of eligible raster layers
8. final encode
9. provenance manifest

48K is an output/render ceiling. It does not assert that every source or generation model produces native 48K frames. Text, Quran, citations and factual diagrams must be rendered as clean vector/text layers at the final target size instead of being repeatedly upscaled from raster screenshots.

## Reproducibility

The final artifact is backed by a timeline/evidence manifest so the movie can be rebuilt if a source, license, scientific finding or translation changes. Each visual, audio, model and citation has provenance metadata.

## Candidate promotion gates

Rights -> evidence verification -> scientific/religious integrity -> security -> Arabic quality -> audiovisual quality -> performance/resource cost -> provenance -> human review -> CI.

No video model, voice, footage source or renderer is promoted automatically.

## IslamReligion.com multilingual video reference

IslamReligion.com is registered as a multilingual Islamic video/reference source. The canonical video entry is `https://www.islamreligion.com/videos`; localized video routes use the language index, for example `/ar/videos`, `/ru/videos`, and `/fr/videos`.

The French URL `https://www.islamreligion.com/fr/category/33/preuves-que-lislam-est-la-verite` is registered specifically as the French localized entry for the "Evidence Islam is Truth" category. Category numeric IDs and slugs are language-scoped and must be resolved from each localized source navigation rather than copied from another language.

The category page is useful for Islamic/dawah context and discovery, including its scientific-miracles taxonomy, but its claims remain subject to independent evidence verification in the video engine. Its media remains reference-only unless a compatible license or explicit permission is recorded by the rights gate.


### Three linked entry points

The IslamReligion integration keeps three connected navigation levels rather than treating one URL as the whole source:

1. The global site/language index: `https://www.islamreligion.com/`
2. The localized video hub: `https://www.islamreligion.com/{lang}/videos` (English defaults to `/videos`)
3. The localized "Evidence Islam is Truth" video category: `https://www.islamreligion.com/{lang}/category/33/preuves-que-lislam-est-la-verite`

The site currently exposes 15 language links in its navigation, but this observed set is not an architectural limit. New language links must be discoverable from the source navigation without a code change. The same rule applies to newly added video categories and child categories.


## IslamReligion.com — complete source family

The integration is not limited to one video page or two categories. The source family includes the global site, localized navigation, video hub, article hub, e-books, Islam at a Glance, category pages, and source-search entry points.

Registered resource classes include:
- website/home
- video hub
- video categories
- article categories
- articles hub
- e-books
- Islam at a Glance
- site-search/discovery queries

The current registry preserves all supplied routes as distinct resources. In particular, `/category/124/how-to-convert-to-islam` and `/category/1124/how-to-convert-to-islam` are retained separately because identical titles do not prove identical resources.

The evidence-oriented video category `/category/1033/evidence-islam-is-truth` currently lists 123 videos and links to subcategories including 17 scientific-miracles-of-the-Holy-Quran videos and 2 scientific-miracles-of-the-Prophet-Muhammad-Sayings videos on the English page. The site also exposes other video categories including Benefits of Islam, Worship and Practice, The Hereafter, Stories of New Muslims, Comparative Religion, The Holy Quran, The Prophet Muhammad, Current Issues, Islamic History, Systems in Islam, Islamic Songs, New Muslims, and Short Videos About Islam. citeturn810256view0turn947294search2

These resources serve discovery, contextual research, documentary planning and source navigation. They do not automatically become scientific primary evidence, canonical religious text, or reusable media. Media reuse remains blocked until the rights layer records a compatible license or explicit permission.


## Evidence-to-Original Multilingual Production

English or other-language IslamReligion videos may be used as **research references** for the encyclopedia's original-video engine. The engine may extract claims, references, timestamps, presenters/authors, Quran references, hadith references, and scientific terms from a source video.

The source video itself is not automatically copied into the new production. Raw-video reuse, audio reuse, frame reuse, clip reuse, and verbatim transcript reuse remain disabled by default. Any quotation or excerpt requires the rights policy to authorize it.

The extracted material enters an independent verification stage:
- Quran and hadith references are checked against canonical/qualified Islamic sources and hadith grading metadata.
- Scientific statements are checked against independent scientific literature, institutional sources, datasets, or other authoritative scientific evidence.
- Interpretive relationships remain explicitly labeled and cannot silently become scientific facts or religious rulings.

After verification, the engine creates an original claim/evidence representation, original script, original visual plan, and localized narration. The source language of the reference video does not restrict the target language of the final production.

The final provenance manifest records the originating IslamReligion video and its timestamps/references, alongside the independent evidence used to verify the resulting claims.
