# Parallel Search Governance Network

The main search is the only user-facing search entrypoint. Behind it, provider jobs fan out in parallel to reduce latency and improve discovery coverage.

## Execution path

`User Query → Language Resolution → Main Search → Parallel Provider Jobs → Merge/Deduplicate → Rank/Validate → Answer`

The current execution contract limits concurrent provider jobs to 8 and bounds each provider operation to a short timeout. A failed or slow provider is isolated from the overall response.

Provider output is discovery material. It is not authority merely because a provider returned it. Provenance, rights and validation remain independent gates before content can be ingested, downloaded, embedded or redistributed.

A short-lived process cache may be used for repeat queries, and retry may be used for transient provider failures. Neither mechanism bypasses provenance, rights or validation.

The user receives one normalized search response; internal provider topology, fan-out count and individual connector failures are not exposed as the answer surface.

## Current integration

`unifiedSearch()` fans out to the Dorar hadith search, unified source index, fiqh research, historical research, official institutions, rijal research, scholar research and knowledge context providers. These eight jobs are coordinated under the same concurrency and timeout contract.

The search layer does not mutate canonical Corpus content and does not grant redistribution rights.
