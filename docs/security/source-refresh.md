# Secure Source Refresh

External source refresh is an untrusted ingestion path:

source registry -> URL/network policy -> fetch -> limits -> scan -> parse -> provenance -> rights -> diff -> validation -> atomic publication.

Rules:
- Never fetch arbitrary user-controlled URLs from privileged network context.
- Prefer an allowlist of approved source domains.
- Block loopback, link-local, private, metadata, and other internal targets.
- Re-check the resolved destination after redirects/DNS resolution.
- Enforce response-size, decompression-ratio, recursion-depth, and time limits.
- Never execute downloaded code.
- Treat HTML, PDF, archives, images, media, OCR output, and generated text as untrusted until validated.
- A refresh proposes a change; it must not silently replace authoritative content.
- On uncertainty, fail closed and retain the previous verified version.
