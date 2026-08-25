# Dual-Account Algorithmic Governance — 2026

## Purpose

Keep the primary account (`lalibimohamed-maker`) and secondary account (`lalibimohamed82-coder`) coordinated without turning the secondary account into an administrative bypass or a single point of failure.

## Roles

### Primary — `lalibimohamed-maker`
- Final repository ownership and administrative authority.
- Primary owner for security controls, source-trust gates, release integrity, dependency manifests, and protected configuration.
- Final decision-maker for sensitive scholarly provenance and rights boundaries.

### Secondary — `lalibimohamed82-coder`
- Independent maintainer and reviewer for ordinary content/application paths.
- Can review, test, harden, document, and improve non-sensitive code and content foundations.
- Must not receive administrative bypass authority merely for continuity.

## Two-person control loop

1. A change is proposed on a topic branch.
2. CI and security gates evaluate the change.
3. The account that authored/pushed the latest change cannot satisfy the independent-review requirement for that same change.
4. The other account reviews the exact current diff.
5. A changed diff invalidates the old approval where GitHub's stale-review policy applies; the current state must be re-reviewed.
6. Protected `main` remains the only promotion path.
7. Auto-merge may complete only after the configured checks and review requirements are satisfied.

## Scope separation

The secondary account is intentionally shared owner with the primary account for ordinary `src`, `test`, `scripts`, `docs`, and general `config` paths. Security and source-trust controls remain primary-only through explicit CODEOWNERS rules.

## Continuity and fail-closed behavior

- If either account is unavailable, automated discovery, testing, health checks, and issue/report generation may continue.
- No automation may use account unavailability as permission to bypass protected review, provenance, rights, or security gates.
- When a preferred engine or provider is unavailable, only a pre-qualified free fallback may be selected automatically.
- If no qualified fallback exists for a security-sensitive operation, the operation fails closed.

## Governance invariants

- No self-approval of a change by its author.
- No administrative bypass granted to the secondary account solely for convenience.
- No silent promotion of discovered scholarly text.
- No automatic override of rights or provenance controls.
- No paid dependency may become a hidden hard requirement.
- Every automatic improvement remains observable through Git history, CI evidence, or an issue/report.

## Review model

The repository should continue to use protected branches/rulesets, required status checks, independent review, and CODEOWNERS for sensitive paths. This combines account separation with repository-native controls rather than relying on trust in either account alone.
