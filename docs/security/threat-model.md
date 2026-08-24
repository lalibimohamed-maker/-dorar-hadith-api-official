# Dīn Allāh Threat Model

Assets: source code, Git history, CI/CD, Corpus, source registry, provenance, rights metadata, generated books/media, search indexes, secrets/signing credentials, backups and recovery material.

Threats: dependency or action compromise, malicious PR, secret leakage, source-refresh compromise, SSRF, malicious archives/OCR/media, artifact substitution, unauthorized Corpus mutation, denial of service, destructive deletion, and backup compromise.

Objective: compromise of one boundary must not automatically compromise another. Sensitive changes must be authenticated, authorized, validated, auditable, integrity-verifiable, and recoverable.
