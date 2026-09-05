# Developer Review Acquisition

## Non-destructive rule

The 01–400H master catalog is the authoritative inventory of discovered works and sources. A source is never removed from the catalog because a copy is unavailable, restricted, or rights are uncertain.

## Availability vs. redistribution

The pipeline records two independent facts:

- `availability`: whether a usable copy was actually acquired from a catalogued source.
- `rights_action`: whether the catalog currently supports public redistribution or the copy must remain in the developer review vault.

A downloadable/hosted file is not treated as proof of redistribution permission.

## Retention

Successful research copies are retained. Restricted or rights-unverified copies are encrypted before persistence using the repository secret `REVIEW_VAULT_KEY`. Plaintext copies are never committed to the repository by this workflow.

The acquisition step does not delete a successful source copy. The only plaintext removal performed by the workflow is removal of the already-encrypted local staging file after encryption, so that the retained encrypted copy is the durable record.

## Verification

Each retained copy records its source URL, byte size, SHA-256, and PDF validation result. Edition identity remains tied to the catalog record; a different edition must not silently replace the requested edition.

## Open-access copies

Copies whose catalog rights status is `verified-redistributable` remain eligible for the normal governed public-acquisition path. This developer-review path exists so that rights uncertainty does not cause loss of research evidence.

## Security

`REVIEW_VAULT_KEY` must be configured as a GitHub Actions secret. It must never be placed in source files, commits, issue comments, or chat messages.
