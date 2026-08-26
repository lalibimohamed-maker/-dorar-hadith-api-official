# Defense-in-Depth Security Framework Map — 2026

This document translates the supplied technical-security article into controls appropriate for the Din Allah Encyclopedia. It deliberately distinguishes repository controls from optional external runtime systems.

## 1. Governance and continuous risk management

Use NIST CSF 2.0 as the organizing risk-management model, CIS Controls v8.1 as the prioritized operational safeguard set, and NIST SSDF 1.1 for secure software-development practices.

Repository application: protected `main`, independent review, least-privilege Actions, continuous CI/security checks, source provenance, fail-closed gates, and auditable recovery.

## 2. Malware and suspicious-content detection

The repository already uses ClamAV, YARA, Trivy, Gitleaks, CodeQL, and dependency checks. YARA release material is checksum-verified before extraction.

Emergency application: a trusted high-confidence malware, artifact-tamper, secret, workflow, provenance, or rights-control signal can raise CRITICAL; corroborated independent high-severity signals or an explicit emergency signal raise EMERGENCY. Promotion is frozen and evidence is preserved.

## 3. Network and transport protection

The article calls for firewalls and encrypted transport. In this repository these controls belong at the deployment boundary rather than inside Git objects: TLS for externally exposed services, restrictive inbound/outbound network policy, rate/resource limits, and reverse-proxy protection where deployed. No repository file may claim a firewall is active unless the deployment environment reports it.

## 4. Application security

OWASP ASVS 5.0 is the verification reference for web/API technical controls. Relevant checks include input validation, authentication/authorization boundaries, secure error handling, resource limits, transport security, and protection of sensitive operations.

## 5. Adversary behavior and emergency sensing

MITRE ATT&CK supplies a common vocabulary for adversary tactics/techniques and detection coverage. The repository Emergency Security Orchestrator provides deterministic correlation of independent signals and a fail-closed response plan.

Wazuh FIM/Active Response and Falco runtime detection are optional external sensors for a real deployment. Their alerts may be adapted into the orchestrator; their absence is not represented as an installed component.

## 6. Software supply chain

Use GitHub artifact attestations for build provenance where supported, Sigstore for artifact signing/verification, SLSA for supply-chain integrity, OpenSSF Scorecard for repository supply-chain posture, and CycloneDX SBOM/VEX/VDR formats for component transparency.

Do not treat an attestation as proof that an artifact is harmless; verification establishes provenance and integrity evidence that must still be combined with policy and scanning.

## 7. Incident response

Apply the incident-response sequence:

`DETECT → TRIAGE → FREEZE PROMOTION → PRESERVE EVIDENCE → QUARANTINE → RESCAN → RECOVER/REPAIR → INDEPENDENT REVIEW → RELEASE`

Automated actions must remain bounded and non-destructive. Recovery must never bypass protected `main`, provenance, rights, or independent-review controls.

## 8. Content and Corpus security

For books, OCR, hadith, tafsir, seerah, translations, audio/video, and other scholarly material:

- Discovery is not trust.
- Free access is not redistribution permission.
- OCR output is derived evidence, not authoritative text.
- Source identity, attribution, provenance, rights, edition/revision identity, and verification state remain separate.
- Changed protected sources are quarantined rather than silently overwriting trusted data.
- Corpus writes occur only after the existing verification and rights gates.

## 9. Updates and vulnerability management

Enable automated dependency updates and review proposals through protected PRs. Treat vulnerability management as continuous: identify, prioritize, remediate, test, and re-check. Security fixes must not be applied by blind automation that bypasses review.

## 10. Security-awareness requirement

The article correctly identifies people as part of the attack surface. Repository automation cannot replace operator awareness. The project should maintain concise operator guidance for phishing, token handling, GitHub review safety, untrusted downloads, and incident escalation. This is a governance/control-plane activity, not a source-content transformation.

## Evidence rule

A control is `implemented` only when code/configuration or an explicit control-plane signal proves it. A framework name, documentation paragraph, or optional external product does not by itself prove activation.

## Reference standards

- NIST Cybersecurity Framework (CSF) 2.0
- NIST SP 800-218 Secure Software Development Framework (SSDF) 1.1
- CIS Critical Security Controls v8.1
- OWASP ASVS 5.0.0
- MITRE ATT&CK
- SLSA
- Sigstore
- OpenSSF Scorecard
- CycloneDX
- Wazuh FIM/Active Response (optional runtime)
- Falco runtime security (optional runtime)
- NIST incident-response guidance
