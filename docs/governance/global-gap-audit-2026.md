# Global Gap Audit — Deen Allah Encyclopedia 2026

هذه الوثيقة تسجل فجوات عالمية يجب أن تغطيها الموسوعة دون تغيير Corpus أو تحويل الأدوات إلى مصادر علمية.

## 1. Preservation / Digital Continuity

- PREMIS-style preservation metadata for objects, events, rights, and agents.
- Fixity checks and content hashes for durable objects.
- Format/version tracking for books, scans, audio, video, datasets, and indexes.
- Verified restore drills and migration plans for obsolete formats.
- Long-term provenance retained separately from mutable search indexes.

## 2. Scholarly Identity / Bibliographic Interoperability

- Crossref metadata ingestion for DOI works, licenses, abstracts, updates, ORCID/ROR identifiers, and citations.
- Prefer OpenAlex and other open scholarly metadata sources when licensing/API terms permit.
- Keep DOI, ISBN, ISSN, ORCID, ROR, publisher, edition, and repository identifiers distinct.
- Deduplicate records without silently merging different editions or statements.

## 3. Media Provenance / Authenticity

- C2PA/content credentials may be recorded for images, audio, and video when present.
- Provenance metadata must not be treated as a truth judgment; it verifies declared history/association and must remain separate from scholarly verification.
- Preserve source URL, creator, license, capture/edit history, and cryptographic hash when available.

## 4. AI Governance / Evaluation

- Apply a documented AI risk-management process for generative and assistive AI.
- Record model/version, task class, evaluation set, language, confidence, known limitations, and human-review state.
- Do not let AI output overwrite authoritative religious or scientific content.
- Extraordinary scientific, historical, or religious claims require independent evidence and human review.

## 5. Accessibility / Internationalization

- Target WCAG 2.2 and programmatically identify page and content language.
- Support RTL/LTR, mixed-language passages, captions, keyboard navigation, screen readers, reduced motion, contrast, and accessible authentication.
- Sign languages are language-specific; never assume one universal sign language.

## 6. Open Science / Data

- Prefer primary sources, institutional repositories, peer-reviewed literature, and open metadata.
- Maintain source-first links even when content cannot legally be rehosted.
- Cache public scholarly metadata responsibly and identify the User-Agent/polite access path where requested.
- Do not mirror protected full text merely because metadata are open.

## 7. Current Candidates for Integration

- PREMIS preservation model — Library of Congress.
- Crossref REST/public metadata — open scholarly metadata; the 2026 public data file contains nearly 180 million DOI records.
- C2PA Specifications 2.4 — media provenance and content credentials.
- NIST AI RMF + Generative AI Profile — AI risk and evaluation governance.
- WCAG 2.2 — accessibility and language-of-content requirements.
- Sigstore/Cosign — artifact signing and verification for software supply chain.

## 8. Decision Rule

`ADOPT` only after license/terms, security, maintenance, performance, interoperability, and Arabic suitability are checked.

`TRIAL` for promising components requiring benchmark or local-language validation.

`ASSESS` for candidates whose fit or rights require more evidence.

`HOLD` when adoption risk is higher than demonstrated benefit.

No global source, model, standard, or tool becomes authoritative merely because it is popular or technically impressive.
