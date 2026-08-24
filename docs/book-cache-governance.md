# Book cache governance

The book cache is a controlled technical layer, not a source of authority by itself.

A book may enter the cache only when all four gates are present:

1. source identity and URL;
2. provenance identity and verification timestamp;
3. redistribution rights in an explicitly allowed state (`redistributable`, `licensed`, or `public-domain`);
4. successful validation.

If any gate is missing or uncertain, the request is blocked. Discovery results are never treated as evidence of redistribution rights.

This policy does not ingest book text and does not modify the existing corpus. It establishes the safety boundary that future OCR, storage, indexing, and export layers must use.