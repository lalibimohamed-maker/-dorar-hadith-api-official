# Free High-Assurance Security Shield

This design borrows security principles from high-assurance mobile platforms without pretending that software can manufacture a hardware Secure Enclave. It uses only free/open-source controls where practical and preserves the existing `main` ruleset and fail-closed model.

## 1. Software root of trust

- Git history and protected `main` are the change boundary.
- GitHub Actions are pinned to immutable commit SHAs.
- Security workflows are independently checked by the existing Action Pin Guard and Workflow Security Gate.
- Release artifacts should use keyless Sigstore signing/provenance when a release pipeline is introduced.

Sigstore supports keyless signing with ephemeral keys bound to OIDC identities and records signing events in a public transparency log. This is the software analogue of a verifiable chain of custody, not a replacement for hardware root of trust.

## 2. Secure-boot analogue

Every executable change must pass:

`PR -> YAML/security validation -> tests -> CodeQL/Security -> dependency review -> review -> protected main`

No direct production mutation is allowed by the security architecture.

## 3. Secure-enclave analogue

`src/security/security-shield.js` provides a small software security boundary:

- explicit capabilities;
- default deny for missing capabilities;
- lockdown denial for high-impact capabilities;
- hash-linked audit events;
- deterministic anomaly detection.

It does not claim hardware isolation. Real secret isolation should use a dedicated secret manager such as OpenBao when deployment infrastructure permits it. OpenBao provides encrypted secret storage, identity-based authorization, leases, revocation and audit logging.

## 4. App sandbox analogue

AI agents and automation must be treated as separate principals. The intended capability progression is:

`Read -> Analyze -> Propose -> Test -> Review -> Merge`

High-impact capabilities (`merge`, `source:refresh`, `corpus:write`, `secret:read`) are denied during `SECURITY_LOCKDOWN_MODE=true`.

For host/container deployments, stronger runtime isolation can be added with gVisor. gVisor provides a userspace application kernel and per-sandbox isolation intended to reduce host-kernel exposure. It is optional because GitHub-hosted runners do not give this repository control of the host kernel.

## 5. Lockdown mode

Set:

`SECURITY_LOCKDOWN_MODE=true`

Optionally record:

`SECURITY_LOCKDOWN_REASON=<incident-id>`
`SECURITY_LOCKDOWN_ACTIVATED_AT=<ISO-8601>`

Lockdown is a fail-closed mode for high-impact operations. Read-only operations may continue according to the caller's capability set.

## 6. Threat sentinel analogue

The runtime shield detects simple high-signal anomalies without a paid SIEM:

- bursts of writes;
- bursts of failed/denied actions;
- repeated denied access to secrets/merge/publish operations.

For Linux-hosted deployments, Falco is an optional next layer. Falco monitors kernel/runtime events and evaluates them against customizable rules, providing near-real-time runtime threat detection.

## 7. Secrets

GitHub Secret Protection and Push Protection remain authoritative for the repository. For hosted applications, long-lived credentials should be minimized. OpenBao can provide short-lived leased credentials and revocation when an operator-controlled host is available.

## 8. Supply chain

The free CI shield runs Trivy in repository mode with vulnerability, misconfiguration and secret scanning. Trivy supports all three scan classes in repository/filesystem targets and can also generate or scan SBOMs.

The repository continues to use Dependency Graph, Dependency Review, Dependabot, `npm audit`, CodeQL, Scorecard, full-SHA action pinning and the existing security gates.

## 9. Integrity and recovery

Verified source content remains authoritative. Derived OCR, generated artifacts, search indexes and cached transformations are not allowed to silently replace verified source material.

Recovery remains fail-closed: preserve the last verified state, quarantine the suspect state, revoke affected credentials, validate the restored state, then publish.

## 10. What software cannot reproduce

This architecture cannot manufacture:

- a CPU-backed hardware root of trust;
- a Secure Enclave/TEE independent of the host;
- device-bound biometric authentication;
- a hardware-enforced verified boot chain.

The correct approach is to approximate the *security properties* with independent software controls while clearly preserving these boundaries.
