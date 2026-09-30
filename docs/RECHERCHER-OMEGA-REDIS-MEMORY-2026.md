# Rechercher Omega — Redis conversation memory

Rechercher Ω keeps the in-process working conversation bounded and volatile. The self-hosted Redis layer adds distributed session/audit metadata without turning Redis into a second scholarly Corpus.

## Storage contract

The Redis adapter at `src/rechercher-omega-redis-memory.js` is deliberately **digest-only**. It stores:

- role;
- SHA-256 of the turn content;
- character count and timestamp;
- bounded evidence identifiers;
- optional verified output SHA-256;
- a boolean indicating whether the turn passed the evidence gate.

It does **not** store raw conversation text. The session identifier is hashed before becoming a Redis key.

Each session is bounded by `maxTurns` (default 20) and protected by a TTL (default 3600 seconds). Appends use Redis `MULTI/EXEC` and the adapter reuses one TCP connection instead of opening a new socket for every turn. The RESP parser operates on raw bytes so Arabic UTF-8 data is handled correctly.

## Evidence boundary

Redis is operational memory, not evidence. The only scholarly truth remains the verified Corpus and its provenance/hash records. A Redis record can help correlate a session or audit a turn, but it can never authorize an answer or become a citation source.

## Failure policy

The adapter itself fails closed when Redis is unavailable. Callers that explicitly require distributed session memory should treat `REDIS_*` failures as a blocked operational state rather than silently pretending persistence succeeded. Callers that do not require Redis may continue using the existing bounded volatile working memory.

## CI proof

`test/rechercher-omega-governance-redis-e2e.integration.test.js` exercises:

1. exact source-backed acceptance;
2. one-character/diacritic mutation rejection;
3. stale evidence-hash rejection;
4. `NO_EVIDENCE_FOUND` fail-closed behavior;
5. the same gate through the API and MCP endpoints;
6. 200 concurrent API/MCP verification requests;
7. 100 concurrent Redis writes with a 64-turn bound;
8. TTL presence and raw-content non-leakage.

The dedicated GitHub Actions workflow starts a free self-hosted Redis container and sets `REQUIRE_REDIS_E2E=1`, so the live Redis part cannot silently downgrade to a skipped test in CI.

This CI proves the implementation and integration contract. It does not prove that every future language/Unicode normalization, model behavior, or semantic claim is mathematically free of hallucination; those remain separate governed test classes.
