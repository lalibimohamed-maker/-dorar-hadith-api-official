# Rechercher multilingual source-format policy (2026)

## Acquisition order

For each 3,192-cell multilingual matrix cell:

1. Search eligible first-party/registered sources for PDF candidates.
2. If no eligible PDF is acquired, search the same eligible source pool for DOCX candidates.
3. When DOCX is the only usable source format, retain the original DOCX and generate a derived PDF from that DOCX.
4. The derived PDF is never treated as the source original; its manifest record must reference the source DOCX SHA-256.

## Representation rules

- PDF remains the preferred native source format.
- DOCX is a supported native source format, not an error condition.
- DOCX fallback requires a real DOCX container and successful conversion to a valid PDF.
- Both files receive independent SHA-256 identities.
- A derived PDF records `derived_from_sha256`, `derived_from_format: docx`, and `derived_from_path`.
- No `.pdf.enc`, `.enc`, or other encrypted review artifact is created by this acquisition path.
- No acquired representation is written to Corpus by this workflow.

## Rights and storage

Rights classification is applied to the source item before acquisition. Public items may be persisted to the dedicated matrix Release store; research-only items remain in protected storage. Global SHA-256 deduplication applies to both PDF and DOCX assets.

## Manifest

The multilingual acquisition manifest records physical PDF and DOCX files separately:

- `total_pdf_files`
- `total_docx_files`
- `total_derived_pdf_files`
- `total_files` = all physical PDF + DOCX files in the run

Deduplicated references may omit a runner-local path, but must retain a non-empty `duplicate_of` reference.
