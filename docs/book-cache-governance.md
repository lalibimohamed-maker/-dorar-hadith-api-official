# Book cache governance

The book cache is a controlled technical layer, not a source of authority by itself.

A book may enter the cache only when all four gates are present:

1. source identity and URL;
2. provenance identity and a valid verification timestamp;
3. redistribution rights in an explicitly allowed state (`redistributable`, `licensed`, or `public-domain`);
4. successful validation.

If any gate is missing or uncertain, the request is blocked. Discovery results are never treated as evidence of redistribution rights.

## Book source connector

The source connector is a contract-only qualification layer for a future fetch path. It requires:

- `resourceId`;
- source identity with a stable id and HTTP(S) URL;
- provenance containing resource identity, source identity, edition/version/revision, and a valid verification timestamp;
- allowed redistribution rights;
- `validation.status` equal to `valid`.

Its result is `eligible` or `blocked` (fail-closed). Eligibility is not permission to redistribute and does not itself perform any network fetch.

The connector performs no HTTP fetching, OCR, storage, indexing, or Corpus mutation. A future fetcher must re-run the governance contract before acquisition and before any downstream storage, OCR, indexing, publish, or export operation.

This policy does not ingest book text and does not modify the existing corpus.