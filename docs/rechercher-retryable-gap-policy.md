# Rechercher retryable acquisition gaps

Rechercher keeps unresolved acquisition gaps pending for the next scheduled queue pass.

## Retryable gaps

- missing safe expected-volume evidence (`blocked-missing-expected-volumes`);
- incomplete source coverage (`incomplete_source`);
- source/transport availability failures (`source_error`, `download_error`);
- a book with only those retryable volume failures is reported as `partial`.

A retryable gap is not promoted to `acquired`, and the catalog entry is never deleted to make the queue appear complete.

## Blocking failures

Integrity and quality failures remain blocking. Examples include:

- invalid PDF signature;
- qpdf/PDF validation failure;
- PDF quality-gate rejection;
- unified PDF validation or quality failure.

A volume with an integrity-blocking candidate causes the book result to become `integrity-failed` rather than retryable `partial`. The sequential wrapper therefore preserves a non-success exit for that run.

## Persistence and retry behavior

The scheduled queue may retry unresolved coverage/transport gaps on later runs. The acquisition manifest only receives an `acquired` record after every expected volume is present as a real, validated PDF and the unified PDF passes its validation and quality gates.

The volume-evidence ledger may persist resolved evidence for reuse, while unresolved evidence remains unresolved; no volume count is guessed from title/author alone.
