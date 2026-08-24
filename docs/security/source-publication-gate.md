# Source Publication Gate

A verified source refresh is never authoritative by itself.

## Required stages

1. **Identity** — the candidate must map to an existing registered source identity.
2. **Provenance** — record canonical URL, retrieval time, final URL, content hash, and source owner.
3. **Rights** — reject publication when the repository does not have a documented right to reproduce the content; retain metadata/link when appropriate.
4. **Schema** — parse into the expected source-specific structure.
5. **Integrity** — compare the candidate against the last accepted fingerprint and reject malformed or unexpectedly destructive diffs.
6. **Quality** — run corpus/source validation before publication.
7. **Quarantine** — uncertain, failed, or suspicious candidates remain isolated.
8. **Atomic publication** — only a fully validated candidate may replace the accepted version.
9. **Rollback** — retain the previous accepted version so a bad refresh can be reverted.

## Safety boundary

The network is treated as untrusted input. A source being reachable or having changed does not grant it write authority over the Corpus.

Automatic checking may run unattended. Automatic authoritative publication must remain gated by all applicable validation and rights checks.