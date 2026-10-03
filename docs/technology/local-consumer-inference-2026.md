# Local Consumer Inference — 2026

The local consumer inference layer sits above the canonical Corpus and below platform UI/voice entry points.

## Runtime boundary

Browser/PWA clients use an explicit local backend boundary:

- WebGPU through ONNX Runtime Web when available.
- WASM through ONNX Runtime Web as the portable local fallback.
- Native mobile runtimes through an adapter boundary when a platform ships ONNX Runtime Mobile or an equivalent local execution layer.

The server package does not gain a browser-only runtime dependency from this boundary.

## Safety and integrity

A model must already be provisioned locally and pass the repository's model/evidence verification gates before admission.

`offline_only` never reaches the network.

`auto` may expose an online path only as an explicit application decision; it never silently upgrades a missing local model into a remote or paid inference call.

`online_only` does not use the local runtime.

No local inference path writes to canonical Corpus data.
