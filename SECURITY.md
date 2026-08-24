# Security Policy — Dīn Allāh Encyclopedia

## Scope
Security protects source code, CI/CD, source registry, Corpus, provenance, rights metadata, generated artifacts, APIs, and release infrastructure.

## Defensive principles
- Defense in depth, least privilege, and fail-closed decisions.
- Treat external sources and fetched content as untrusted input.
- Never store secrets in source code, client apps, or generated artifacts.
- Automated source refreshes must never directly overwrite authoritative Corpus content.
- Preserve provenance, retrieval time, hashes, and rights state.
- Separate production, deployment, signing, and backup credentials.
- Maintain recoverable backups and verify restoration.
- Prefer mature open-source/self-hostable controls; paid services must not be single points of failure.

## Secure source refresh
Every automated source update must pass source identity/allowlist checks, TLS and redirect validation, SSRF-safe network policy, size/type/time limits, archive/decompression limits, scanning where applicable, schema validation, provenance/rights checks, diff and quality gates, and atomic publication. Any uncertainty keeps the previous verified version.

## Incident response
Contain, revoke, isolate, preserve evidence, patch, verify, restore, and document. The project does not retaliate against or compromise attacker systems.
