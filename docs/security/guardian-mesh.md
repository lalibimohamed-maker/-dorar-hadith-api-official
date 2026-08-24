# Autonomous Defense Mesh

This layer is defensive only. It never compromises, scans, or attacks external systems.

## Guardian layers

1. Detection Guardian — identifies anomalous authentication, request, workflow, source-refresh, and repository activity.
2. Integrity Guardian — protects Corpus, source registry, provenance, generated artifacts, and critical configuration.
3. Response Guardian — applies safe automatic containment: stop affected jobs, quarantine untrusted inputs, revoke/disable suspected credentials where supported, block unsafe publication, and create an incident record.
4. Recovery Guardian — preserves the last verified state and supports controlled restoration.

## Response levels

- observe: record and alert.
- contain: isolate the affected job/input/session and stop publication.
- lockdown: freeze automated source refresh and deployments.
- recover: restore only from a verified artifact/backup after integrity validation.

## Safety invariants

- No retaliatory access to attacker infrastructure.
- No destructive action outside this repository and its authorized infrastructure.
- No automatic deletion of evidence.
- No automatic replacement of authoritative Corpus data from an unverified source.
- Fail closed when provenance, integrity, or authorization is uncertain.
- Every automatic action is auditable.
