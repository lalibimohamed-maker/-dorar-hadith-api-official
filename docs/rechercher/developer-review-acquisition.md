# Developer Review Acquisition

## Non-destructive rule

The 01–400H master catalog is the authoritative inventory of discovered works and sources. A source is never removed from the catalog because a copy is unavailable, restricted, or rights are uncertain.

## Availability vs. redistribution

The pipeline records two independent facts:

- `availability`: whether a usable copy was actually acquired from a catalogued source.
- `rights_action`: whether the catalog currently supports public redistribution or the copy must remain in the developer review vault.

A downloadable/hosted file is not treated as proof of redistribution permission.

## Retention and primary representation

The acquired **.pdf is the sole primary representation of the book**.

- Rechercher does not create a second permanent `.pdf.enc` copy from a newly acquired PDF.
- The validated `.pdf` remains the Developer Review working copy and the canonical acquisition object.
- The same book must not be stored twice merely because of a storage or encryption format.
- Historical `.pdf.enc` vault assets, if they already exist, are preserved as legacy recovery material and are not treated as a second scientific book or re-ingested as a new work.
- Decryption/recovery of legacy material may recreate the original `.pdf` for review; it must not create a duplicate catalog/Corpus record.
- No storage transition may delete the primary `.pdf` because another representation was created.

## Verification

Each retained copy records its source URL, byte size, SHA-256, and PDF validation result. Edition identity remains tied to the catalog record; a different edition must not silently replace the requested edition.

## Open-access copies

Copies whose catalog rights status is `verified-redistributable` remain eligible for the normal governed public-acquisition path. This developer-review path exists so that rights uncertainty does not cause loss of research evidence.

## Security

Legacy vault recovery, when required for pre-existing encrypted assets, may use `REVIEW_VAULT_KEY`. The key must never be placed in source files, commits, issue comments, or chat messages.
