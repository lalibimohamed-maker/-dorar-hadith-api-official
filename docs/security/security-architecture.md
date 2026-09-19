# Dīn Allāh Encyclopedia — Security Architecture

## Purpose

This document turns the encyclopedia's security principles into a verifiable, layered architecture. The goal is to ensure that failure of one control does not automatically compromise the source code, CI/CD, Corpus, provenance, rights metadata, APIs, or recovery material.

## Security layers

### 1. Least privilege

Every GitHub Actions workflow declares explicit permissions. Workflows should request the smallest token scope necessary for their task, and sensitive write permissions require a documented security purpose.

Repository branch protection is enforced through the active `Protect-main-maximum-security` ruleset. Direct deletion and force-push operations on `main` are blocked, and protected changes must arrive through pull requests with review and conversation resolution.

### 2. Identity and authorization

Humans, automation, and future AI agents are treated as distinct principals. A principal must be authenticated and authorized for the specific operation it performs.

No agent receives persistent unrestricted write access. High-impact operations require a protected pull request path and explicit review.

### 3. Auditability

Security-relevant actions must leave an auditable trail in Git commits, pull requests, workflow runs, security alerts, and source/provenance records.

For content changes, the audit record should preserve at minimum: actor, timestamp, source identifier, retrieval time, content hash, parser/extractor version, validation state, rights state, and publication decision.

### 4. Anomaly detection

The system uses deterministic gates for workflow, source, provenance, ingestion, and security anomalies. Future anomaly scoring may add context, but deterministic fail-closed controls remain authoritative for publication and merge decisions.

An anomaly must quarantine the affected input or change rather than silently promoting it.

### 5. Provenance and integrity

No external content is authoritative merely because it is reachable. Source material must carry provenance and rights metadata and pass validation before becoming verified corpus content.

OCR output is derived data and must never silently replace the underlying source image or verified text.

### 6. Secret protection

Secrets must not exist in source, client applications, generated artifacts, or logs. GitHub Secret Protection and Push Protection are enabled where available. Workflows use read-only permissions by default and avoid persisting checkout credentials.

### 7. Supply-chain security

The repository uses multiple independent controls: Dependabot, dependency graph, dependency review, `npm audit`, CodeQL, OpenSSF Scorecard, full-SHA action pinning, an action pin guard, workflow security gates, and reproducible dependency installation through the lockfile.

A single supply-chain control is never treated as sufficient by itself.

### 8. Recovery

Recovery is a security control, not merely an operational convenience. The project should preserve known-good commits and verified source states, isolate compromised inputs, revoke affected credentials, and restore from a verified state rather than attempting destructive in-place repair.

Recovery procedures must preserve provenance and must never silently replace verified scholarly content with an unverified reconstruction.

## Defense-in-depth examples

### Dependency compromise

`Dependency Graph → Dependency Review → npm audit → CI → CodeQL/security gates → pull-request review → protected main`

### Secret leakage

`Secret Protection → Push Protection → least-privilege token scopes → credential revocation/rotation → audit`

### Corpus/source corruption

`Provenance → quarantine → validation → diff/quality gates → PR review → protected main → verified recovery`

### Malicious AI/automation

`Identity → scoped capability → proposal-only default → tests/security gates → human/protected review → merge`

## Fail-closed rule

When a security control cannot establish safety or integrity with sufficient confidence, the system must preserve the previous verified state and require explicit review. Uncertainty is not a reason to publish.
