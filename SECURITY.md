# Security Policy — Dīn Allāh Encyclopedia

## Security boundary
This project protects source code, CI/CD, source registry, Corpus, provenance, rights metadata, generated artifacts, APIs, releases, and recovery data.

## Principles
- Defense in depth; least privilege; fail closed.
- External sources and fetched content are untrusted until verified.
- No secrets in source, client applications, or generated artifacts.
- Source refreshes never directly overwrite authoritative Corpus content.
- Preserve provenance, retrieval time, hashes, parser/version information, and rights state.
- Separate production, deployment/signing, and backup credentials.
- Maintain recoverable backups and regularly verify restoration.
- Prefer mature open-source/self-hostable controls so no paid service is a single point of failure.

## Secure source refresh
Every automated source update must pass identity/allowlist, TLS/redirect, SSRF-safe network, size/type/time, archive/decompression, scanning, schema, provenance/rights, diff/quality, and atomic-publication gates. Failure or uncertainty retains the previous verified version.

## Incident response
Contain, revoke, isolate, preserve evidence, patch, verify, restore, and document. The project does not retaliate against or compromise attacker systems.
