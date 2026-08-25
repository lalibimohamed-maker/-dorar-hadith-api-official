# Din Allah Encyclopedia — Dual-Account Algorithmic Governance 2026

## Purpose

Establish a two-account governance model that improves continuity, review independence, resilience, and maintainability without duplicating administrative power.

## Roles

### Primary account — `lalibimohamed-maker`

- Repository ownership and final administrative authority.
- Security-critical ownership and emergency governance.
- Final responsibility for repository rules, protected branches, secrets, and bypass controls.

### Secondary account — `lalibimohamed82-coder`

- Independent maintainer and reviewer for approved operational, content, documentation, testing, performance, and non-critical engineering paths.
- May contribute, review, and repair within granted Write access.
- Must not receive repository Admin or branch-protection bypass solely for continuity.

## Governance loop

`propose -> independent review -> checks -> approve -> protected merge -> observe -> improve`

A change authored by one account must not be approved by that same account where the repository rules require independent approval. The current `main` protections remain the final enforcement layer.

## Ownership model

- Shared ownership: content, catalogues, application code, tests, documentation, performance, non-secret automation.
- Primary-only ownership: security workflows, source-trust controls, secrets/configuration with security impact, `CODEOWNERS`, and repository governance itself.
- Every sensitive path keeps provenance, validation, and review requirements.

## Continuity and failover

For automated engines and services, failover may occur only on measurable health, compatibility, availability, or integrity signals. Failover must not silently promote unverified scholarly material.

## Improvement policy

Prefer free/open alternatives first. Evaluate replacements by measured correctness, compatibility, speed, security, maintenance health, and legal/redistribution constraints. A newer dependency or engine is adopted through the same protected review pipeline.

## No duplication of authority

The secondary account is deliberately not an administrative clone. Security comes from separation of duties, review independence, protected `main`, and layered automation rather than from granting identical privileges to both accounts.
