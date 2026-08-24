# Security Hardening Baseline

This document defines the repository security baseline for the Din Allah Encyclopedia project.

## Required controls

- Protect `main` with pull requests and required successful security/quality checks before merge.
- Disallow force-push and branch deletion on `main`.
- Require explicit GitHub Actions `permissions` and default to read-only access.
- Pin third-party and first-party GitHub Actions to immutable full-length commit SHAs.
- Keep CodeQL, OpenSSF Scorecard, dependency auditing, secret hygiene, and Action Pin Guard enabled.
- Keep Dependabot updates enabled for npm and GitHub Actions.
- Keep `CODEOWNERS` coverage on security-sensitive workflows, source-trust controls, security documentation, and dependency manifests.
- Never store credentials, API keys, private keys, or `.env` files in the repository.
- Prefer short-lived identity (OIDC) over long-lived cloud credentials when deployment infrastructure is introduced.
- Treat downloaded books, OCR output, generated artifacts, and source-refresh data as untrusted input until validated.
- Preserve provenance, licensing, checksums, and source-version metadata for imported material.
- Do not publish copyrighted book text merely because a copy is reachable on the web; publication rights must be recorded separately from discovery.
- Do not allow OCR output to become authoritative text without verification against the source page.
- Security controls must fail closed when a required invariant cannot be verified.

## GitHub settings that must be enabled when available

The repository administrators should enforce, at the GitHub repository settings layer:

1. A ruleset/branch protection rule for `main`.
2. Required pull request review(s), with stale approvals dismissed after relevant changes.
3. Required status checks for CI, Security Baseline, CodeQL, Scorecard, and Action Pin Guard.
4. Block force-push and deletion of `main`.
5. Secret scanning and push protection where available.
6. Dependency graph and Dependabot security updates where available.
7. A restrictive GitHub Actions policy that allows only required actions and requires immutable references.
8. Least-privilege repository and environment permissions.
9. Environment protection rules for any future production deployment.

These settings are intentionally documented separately from repository code because they are GitHub control-plane settings and must not be represented as enabled unless GitHub reports them as enabled.

## Verification rule

A control is considered **implemented** only when it is present in code/configuration and has a passing automated check, or when the GitHub control-plane explicitly reports it enabled. Documentation alone is not evidence of activation.
