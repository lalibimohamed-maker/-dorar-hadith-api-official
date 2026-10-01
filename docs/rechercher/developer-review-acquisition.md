# Developer Review Acquisition

## Non-destructive rule

The 01–400H master catalog is the authoritative inventory of discovered works and sources. A source is never removed from the catalog because a copy is unavailable, restricted, or rights are uncertain.

## Availability vs. redistribution

The pipeline records two independent facts:

- `availability`: whether a usable copy was actually acquired from a catalogued source.
- `rights_action`: whether the catalog currently supports public redistribution or the copy must remain in the private protected Releases repository.

A downloadable/hosted file is not treated as proof of redistribution permission.

## Retention

Successful research copies are retained as plaintext `.pdf` Releases assets. Restricted or rights-unverified copies are stored only in the private protected Releases repository. `.pdf.enc`, `.enc`, and `.encrypted` are migration-only inputs and are never a final storage format.

The acquisition step never commits PDF payloads to the repository tree. After a verified Releases upload, the local PDF staging copy is removed and the release URL, SHA-256, bytes, rights state, and access class are recorded in the acquisition evidence.

## Verification

Each retained copy records its source URL, byte size, SHA-256, and PDF validation result. Edition identity remains tied to the catalog record; a different edition must not silently replace the requested edition.

## Open-access copies

Copies whose catalog rights status is `verified-redistributable` remain eligible for the normal governed public-acquisition path. This developer-review path exists so that rights uncertainty does not cause loss of research evidence.

## Security

The protected Releases destination must remain private and its write token is supplied only through the GitHub Actions secret `RECHERCHER_SECONDARY_STORAGE_TOKEN`. PDF payloads and credentials are never placed in source files, commits, issue comments, or chat messages.
