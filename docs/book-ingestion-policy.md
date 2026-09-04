# Book ingestion policy

## Canonical rule
A multi-volume edition is never ingested as an arbitrary single volume. Before acquisition, the encyclopedia must determine the complete volume count for the exact edition from the primary catalog/source and cross-check it against at least one independent catalog or bibliographic source when available.

When the edition is multi-volume, the canonical downloadable artifact is **one unified PDF containing every verified volume in bibliographic order**. Individual volume files may be retained temporarily during acquisition and verification, but the canonical repository artifact is the complete unified PDF.

## Required provenance and integrity record
For every source volume, acquisition must record:

- exact volume number and title
- direct source URL
- source edition/record identifier when available
- rights/provenance evidence for that exact item
- PDF signature check (`%PDF`)
- structural PDF validation
- byte size
- SHA-256

The final unified PDF must also have its own byte size and SHA-256 recorded.

## Completeness gate
An ingestion is incomplete if:

- the expected volume count is unknown;
- one or more expected volumes are missing;
- the source edition cannot be distinguished from another edition with a different volume count;
- the final unified PDF was produced without a per-volume manifest.

## Current Waqfeya application
For **فتاوى اللجنة الدائمة للبحوث العلمية والإفتاء - المجموعتان الأولي والثانية**, the Waqfeya record states 15 volumes, 9381 pages, 205 MB, and marks the item **وقف لله تعالى**. Its download section enumerates 11 volumes under المجموعة الأولى and 4 volumes under المجموعة الثانية. This exact edition is the scope of the 15-volume unified acquisition workflow.
