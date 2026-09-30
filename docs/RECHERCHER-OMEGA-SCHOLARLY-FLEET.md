# Rechercher Ω — Scholarly Domain Fleet

This is the scientific-source software layer above the existing Corpus boundary.

The Quran lane already has a detailed Quran Foundation contract. This document adds the same contract shape to independent scholarly families so that Rechercher does not become “Quran Foundation + a list of unrelated links”.

## First-wave families

| Family | Arabic domain | Initial source types |
|---|---|---|
| quran | القرآن | official API |
| hadith | الحديث | official API + web + scholarly corpus |
| tafsir | التفسير وعلوم القرآن | official API + scholarly corpus |
| sirah | السيرة والتاريخ النبوي | scholarly corpus + library discovery |
| aqidah | العقيدة | scholarly corpus + digital library |
| fiqh | الفقه | official institution + scholarly corpus |
| fatwa | الفتاوى | official institutions |
| biographies | التراجم والرجال | scholarly corpus + web source |
| references | المراجع والفهارس والمكتبات | libraries + metadata services |
| asbab_al_nuzul | أسباب النزول | official API + scholarly corpus |
| sharh | الشروح والتعليقات | scholarly corpus + digital library |
| tajwid | التجويد | digital library + official Quran source |
| qiraat | القراءات والرسم والضبط | official Quran source + digital library |
| usul_al_fiqh | أصول الفقه والقواعد | official institution + digital library |
| islamic_history | التاريخ الإسلامي والحضارة | scholarly corpus + digital library |
| terminology | المصطلحات والمفاهيم الإسلامية | reference site + scholarly corpus |
| ethics_and_spirituality | التزكية والأخلاق والآداب | digital library + scholarly corpus |
| manuscripts | المخطوطات والتراث المخطوط | manuscript databases + digital libraries |
| geography | الجغرافيا والرحلات والأماكن | digital library + scholarly corpus |
| research_indexes | الفهارس ومؤشرات البحث العلمي | metadata API + library catalog |
| encyclopedias | الموسوعات والمعاجم المرجعية | reference database + bibliographic service |
| documents | الوثائق والسجلات الرقمية | digital archive + digital library |
| multilingual_translations | الترجمات متعددة اللغات | official Quran sources + API |
| education | التعليم والمناهج والمتون | digital library + educational repository |

The fleet is now 24 independent families. The nine foundational families are joined by fifteen additional lanes covering أسباب النزول، الشروح، التجويد، القراءات، أصول الفقه، التاريخ والحضارة، المصطلحات، التزكية والأخلاق، المخطوطات، الجغرافيا والرحلات، مؤشرات البحث، الموسوعات، الوثائق، الترجمات متعددة اللغات، والتعليم.

## 24-family expansion

The additional families are deliberately source-pluggable. A family can begin with a public corpus, institutional site, catalogue, metadata service, or digital library without claiming that the source exposes a formal API. `not_documented` and `not_applicable` are valid environment states; invented endpoints are forbidden.

Every source record now carries its own seven-axis `contract`, in addition to the family-level contract. This means a single source can be quarantined or replaced without collapsing the entire domain family.

## Shared contract

Every family must describe the same seven axes:

- production: the real/live environment status.
- pre_live: a documented test environment, or not_documented / not_applicable; never invent an endpoint.
- auth: how credentials/access work.
- sdk: official SDK status or explicit HTTP fallback.
- rights: asset-level rights state and promotion rules.
- provenance: source/locator/retrieval/hash metadata.
- adapter: the exact transport/runtime adapter.

The runtime treats these as contracts, not promises that every source exposes the same kind of API.

## Evidence and rights

A source may be discoverable without being downloadable. API access is not redistribution permission.

Public-download promotion is allowed only after an item reaches one of:

- verified_public_domain
- verified_license
- source_permission

review_required, link_only, and blocked remain fail-closed.

## Source verification notes

Sunnah.com publishes an official API repository and directs developers to its API documentation; its developer page states that an API key is required.

OpenITI is a machine-actionable scholarly corpus with GitHub working repositories and release snapshots. Rechercher therefore treats it as a scholarly-corpus adapter, not as blanket permission to redistribute arbitrary modern editions.

Quran Foundation documents separate pre-live and production environments, server-side confidential credentials for Content APIs, and an official JavaScript SDK path. Its Content API pre-live dataset is explicitly limited for testing, so environment metadata must remain separate from production content claims.

## Boundary

This fleet does not:

- write canonical Corpus data;
- infer religious authority from model output;
- make an AI-based copyright decision;
- turn a web page into evidence without provenance;
- assume a downloadable PDF is redistributable.

It is the executable registry that lets acquisition, search, OCR, bibliographic discovery, and Rechercher Ω agents share one governance contract.
