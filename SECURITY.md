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

## Architecture
The enforceable security model is documented in:

- [`docs/security/security-architecture.md`](docs/security/security-architecture.md) — eight security layers, defense in depth, and fail-closed boundaries.
- [`docs/security/ai-agent-security.md`](docs/security/ai-agent-security.md) — identity, scoped capabilities, agent lifecycle, untrusted input, and AI/automation safety.
- [`docs/security/audit-and-recovery.md`](docs/security/audit-and-recovery.md) — audit minimums, recovery states, and verified restoration.
- [`docs/security/threat-model.md`](docs/security/threat-model.md) — system assets and threat boundaries.

## Secure source refresh
Every automated source update must pass identity/allowlist, TLS/redirect, SSRF-safe network, size/type/time, archive/decompression, scanning, schema, provenance/rights, diff/quality, and atomic-publication gates. Failure or uncertainty retains the previous verified version.

## AI and automation
AI agents, bots, and scheduled automation are separate security principals. They must use the least privilege required for the task and should follow `Read → Analyze → Propose → Test → Review → Merge`. They must not bypass repository protection, provenance gates, or security checks.

## Incident response
Contain, revoke, isolate, preserve evidence, patch, verify, restore, and document. The project does not retaliate against or compromise attacker systems.
