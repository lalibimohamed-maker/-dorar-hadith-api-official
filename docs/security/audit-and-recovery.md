# Audit and Recovery Controls

## Audit minimum

For sensitive repository and content operations, retain evidence sufficient to answer:

- Who or which automation acted?
- What operation occurred?
- Which ref, file, source, or record changed?
- When did it occur?
- Which workflow/commit/PR authorized it?
- What validation and security checks passed or failed?
- What source hash/provenance and rights state were involved?

GitHub commits, pull requests, workflow runs, CodeQL/security alerts, and the repository's provenance records form the primary audit trail.

## Content audit

For source refresh and Corpus publication, an audit record should preserve:

`sourceId → source URL → retrieval timestamp → content hash → extractor/parser version → validation status → rights status → publication decision`

A content item without sufficient provenance must remain unverified.

## Recovery states

Recovery must distinguish at least:

1. **Verified** — known-good and eligible for publication.
2. **Quarantined** — received or changed but not trusted.
3. **Rejected** — failed policy or integrity checks.
4. **Restoring** — rollback or reconstruction is underway.
5. **Recovered** — restored from a verified state and revalidated.

## Recovery sequence

1. Stop the affected automation or publication path.
2. Revoke/rotate credentials if compromise is suspected.
3. Preserve logs, commits, hashes, and affected artifacts as evidence.
4. Isolate/quarantine untrusted data.
5. Identify the last verified state.
6. Restore from that state without overwriting evidence.
7. Re-run integrity, security, provenance, and content validation gates.
8. Re-open normal publication only after verification succeeds.
9. Record the incident and recovery decision in the audit trail.

## Recovery integrity rule

A backup is not considered trusted solely because it exists. Recovery material must itself be validated for integrity and provenance before being used to restore authoritative content.

## Availability and safety trade-off

When safety and freshness conflict, preserve the last verified state. A delayed update is preferable to silently publishing unverified or corrupted scholarly content.
