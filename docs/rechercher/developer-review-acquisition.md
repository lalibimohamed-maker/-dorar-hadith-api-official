# Developer Review Acquisition

## Non-destructive rule

The 01–400H master catalog is the authoritative inventory of discovered works and sources. A source is never removed from the catalog because a copy is unavailable, restricted, or rights are uncertain.

## Availability vs. redistribution

The pipeline records two independent facts:

- `availability`: whether a usable copy was actually acquired from a catalogued source.
- `rights_action`: whether the catalog currently supports public redistribution or the copy must remain in the developer review vault.

A downloadable/hosted file is not treated as proof of redistribution permission.

## Retention and primary representation

- The original `.pdf` is the **sole primary representation** for newly acquired books.
- New acquisition runs must not create a permanent `.pdf.enc` duplicate and must never delete the primary `.pdf` after acquisition.
- Existing historical `.pdf.enc` material is preserved as legacy recovery evidence. When it is decrypted for review, the recovered `.pdf` uses the same scientific identity/SHA-256 boundary and must not create a duplicate catalog or Corpus record.
- GitHub Actions artifacts are review/delivery copies, not permanent scientific storage.

## Verification

Each retained copy records its source URL, byte size, SHA-256, and PDF validation result. Edition identity remains tied to the catalog record; a different edition must not silently replace the requested edition.

## Open-access copies

Copies whose catalog rights status is `verified-redistributable` remain eligible for the normal governed public-acquisition path. This developer-review path exists so that rights uncertainty does not cause loss of research evidence.

## Security

`REVIEW_VAULT_KEY` is reserved for legacy `.pdf.enc` recovery workflows only. New PDF acquisition does not require it. The secret must never be placed in source files, commits, issue comments, or chat messages.
