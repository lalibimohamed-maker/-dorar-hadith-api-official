# Backup / Disaster Recovery Contract v1

## Minimum

- Two encrypted copies of critical metadata and review evidence.
- At least one copy must be offsite/separate from the primary GitHub storage.
- Daily target: RPO <= 24h.
- Recovery target: RTO <= 24h.
- A backup is not considered healthy until a restore test succeeds.

## Required recovery evidence

```text
backup_id
created_at
source_commit
manifest_sha256
artifact_count
encrypted=true
storage_class
restore_test_at
restore_test_result
operator
```

## Rules

1. Never store live secrets in the repository or audit logs.
2. Never replace a historical backup silently; retain immutable identifiers.
3. Test recovery against a disposable restore location.
4. Verify manifest SHA-256 and representative artifact hashes after restore.
5. Record every recovery test as an audit event.

The GitHub review vault is one persistence layer, not the disaster-recovery system by itself.
