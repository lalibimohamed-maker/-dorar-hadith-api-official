# Developer Review Acquisition

## Storage rule

Developer-review copies that the project is permitted to retain for review are kept as ordinary PDF files in **durable private developer-review storage**. They are never stored in the public encyclopedia repository, the public PDF storage repository, or a temporary GitHub Actions artifact.

GitHub Actions artifacts are transient transfer/diagnostic objects only. They are not the retention layer for restricted review PDFs.

## Availability vs. redistribution

- availability: whether a usable copy was actually acquired from a catalogued source.
- rights_action: whether the copy is eligible for public redistribution or must remain private for developer review.

A downloadable or hosted file is not treated as proof of redistribution permission.

## Retention

Restricted or rights-unverified copies may be retained as ordinary PDFs only when the project has the right to access and retain them for review. They remain outside public PDF storage and are not exposed through the encyclopedia.

The retention target is **durable private storage**, not a fixed GitHub Actions artifact lifetime. If durable private storage is unavailable, Rechercher must fail closed rather than silently downgrade the copy to temporary artifact retention.

## Verification

Each retained copy records its source URL, byte size, SHA-256, and PDF validation result. Edition identity remains tied to the catalog record.

## Public publication

Only copies explicitly marked `verified-redistributable` may enter the public PDF path.

## Encryption policy

An encrypted input may still be encountered during acquisition/recovery. When the authorized `REVIEW_VAULT_KEY` is available, Rechercher converts that input to an ordinary validated `.pdf`, verifies it, and deletes the encrypted input.

Rechercher never creates a new encrypted retention copy and never uses `.pdf.enc`, `.enc`, or `.encrypted` as the final storage format.
