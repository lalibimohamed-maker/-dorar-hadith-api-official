# موسوعة الدرر — بنية البحث والمصادر

## المبدأ
The encyclopedia is a search, indexing and source-linking layer for verified Sunni Islamic sources. It is not a substitute for original sources. Search results preserve source identity, source type, verification state, rights state, and bibliography when available.

## Main search entrypoint
`/search?q=...` is the public unified search entrypoint. The federation starts with the official Dorar hadith search and expands across Quran, tafsir, tadabbur, sirah, fiqh, aqidah and Islamic library records.

## Top-level domains
The search contract exposes these twelve domains: Quran and its sciences; tafsir; tadabbur and guidance; hadith and its sciences; musnads and sunan; sirah/maghazi/shamail; fiqh and transactions; usul al-fiqh and maxims; maqasid al-sharia; aqidah; biographies/narrators/scholars; Islamic library.

## Quran context and causes of revelation
Cause-of-revelation relations require verified source evidence. Thematic similarity, lexical overlap, or search relevance alone cannot establish a sabab al-nuzul relationship. Weak or disputed reports retain their status and are not promoted to fact.

## Hadith
Collection membership, source identity and hadith grading are separate fields. A hadith appearing in a musnad or sunan is not automatically authentic. When available, search records can retain collection, chapter, hadith number, source URL and reported grading; missing grading is represented as not reported rather than inferred.

## Fiqh and madhahib
The four Sunni schools are represented independently: Hanafi, Maliki, Shafii and Hanbali. The research layer separates the legal ruling from its evidence, preserves agreement and disagreement, and supports worship, transactions, family law, nawazil, usul and legal maxims.

## Maqasid al-sharia
`مقاصد الشريعة` is the parent domain. Its core hierarchy includes the five daruriyyat: preservation of religion, life, intellect, lineage and wealth, followed by hajiyyat, tahsiniyyat, general/specific/partial maqasid, rules and applications.

## Aqidah
Only verified Sunni-source records are promoted as source-backed research entries. The requested texts include الأصول الثلاثة, الأصول الستة and القواعد الأربع, with explanation and attribution kept separate from the source text.

## Library and downloads
PDF and DOCX can be indexed as bibliographic records. Downloading or redistributing a file requires source/license permission; restricted or unclear rights result in source-link navigation rather than republication. Online availability alone does not grant redistribution permission.

## Quran recitations
Playback/download/offline access is rights-gated. Word-level highlighting requires trusted word-level timing data; when that timing does not exist, synchronization falls back to ayah level. Quranic Arabic remains unchanged.

## Languages
The interface supports multilingual RTL/LTR presentation while preserving access to the original source language. Translations remain distinct assets and are not substituted for original-source text.

## Architecture boundary
Search metadata and relationship layers may enrich discovery and indexing, but canonical Corpus content is not silently rewritten. Generated text is not canonical, discovery is not authority, and rights are never upgraded by discovery alone.