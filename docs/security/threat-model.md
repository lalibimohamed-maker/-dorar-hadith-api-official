# Dīn Allāh Threat Model

## Protected assets

- source code and Git history;
- CI/CD workflows, tokens, signing and deployment credentials;
- Corpus and source registry;
- provenance, rights, verification and publication metadata;
- generated books, OCR, media and search indexes;
- APIs and operational configuration;
- audit records, backups and recovery material.

## Threat classes

- malicious or compromised pull requests;
- dependency, package and GitHub Action compromise;
- secret leakage and credential misuse;
- compromised or malicious source refreshes;
- SSRF and unsafe remote network access;
- malicious archives, OCR, documents and media;
- artifact or build substitution;
- unauthorized Corpus mutation or provenance forgery;
- denial of service and destructive deletion;
- backup or recovery compromise;
- insider misuse by trusted humans, contractors, bots or automation;
- non-human identity and agentic AI misuse;
- prompt injection or hostile external content causing an agent to exceed its intended task;
- data exfiltration through APIs, logs, artifacts, generated files or external integrations.

## Security objectives

Compromise of one boundary must not automatically compromise another. Sensitive changes must be authenticated, authorized, validated, auditable, integrity-verifiable, provenance-preserving, and recoverable.

AI and automation are treated as potentially fallible principals. An agent must not infer authority from instructions contained in untrusted content, and it must not convert read access into write access without an explicit capability boundary.

## Exfiltration controls

Reduce unnecessary data exposure, use least-privileged credentials, avoid placing secrets in logs or artifacts, preserve read-only defaults, and quarantine untrusted inputs before downstream processing. External integrations must receive only the minimum information required for their task.

## Recovery objective

When integrity cannot be established, retain the last verified state, quarantine the affected material, preserve evidence, revoke or rotate impacted credentials, and restore only from a separately verified state.
