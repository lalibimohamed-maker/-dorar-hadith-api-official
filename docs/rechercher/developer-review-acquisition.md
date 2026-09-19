# Developer Review Acquisition

## Storage rule

Developer-review copies that the project is permitted to retain for review are kept as ordinary `.pdf` files in private developer-review storage. The project does not create, retain, decrypt, or publish `*.pdf.enc`, `*.enc`, or other encrypted PDF copies.

## Availability vs. redistribution

- `availability`: whether a usable copy was actually acquired from a catalogued source.
- `rights_action`: whether the copy is eligible for public redistribution or must remain private for developer review.

A downloadable/hosted file is not treated as proof of redistribution permission.

## Retention

Restricted or rights-unverified copies may be retained as ordinary PDFs only when the project has the right to access and retain them for review. They remain outside public PDF storage and are not exposed through the encyclopedia.

## Verification

Each retained copy records its source URL, byte size, SHA-256, and PDF validation result. Edition identity remains tied to the catalog record.

## Public publication

Only copies explicitly marked `verified-redistributable` may enter the public PDF path.

## Encryption policy

`REVIEW_VAULT_KEY` and the `pdf.enc` storage/decryption path are removed from Rechercher. Any encrypted PDF artifact is rejected by the storage hygiene guard.
