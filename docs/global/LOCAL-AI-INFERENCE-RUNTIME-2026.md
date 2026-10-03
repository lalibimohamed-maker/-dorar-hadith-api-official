# Local AI Inference Runtime — 2026

This layer provides a local-only inference boundary for موسوعة دينُ اللّه.

## Runtime

The adapter is `node-llama-cpp`. It is loaded lazily, so the repository remains usable without a local AI runtime installed.

Install the runtime in the machine that will execute local AI:

```bash
npm install node-llama-cpp
```

Do not add model weights to Git. Keep them on local storage and record their SHA-256.

## Roles

| Role | Model family | Required environment |
| --- | --- | --- |
| Generation | Qwen3 8B GGUF | `DEEN_LLM_MODEL_PATH`, `DEEN_LLM_MODEL_SHA256` |
| Embedding | BGE-M3 GGUF | `DEEN_EMBEDDING_MODEL_PATH`, `DEEN_EMBEDDING_MODEL_SHA256` |
| Reranking | BGE-Reranker-v2-M3 GGUF | `DEEN_RERANKER_MODEL_PATH`, `DEEN_RERANKER_MODEL_SHA256` |

Before loading, the model registry requires the configured file to exist, be non-empty, and match its expected SHA-256. Unknown checksums fail closed.

## Health check

```bash
npm run local-ai:doctor
```

This reports whether the runtime is installed and whether each model path/checksum is configured. It does not download anything.

## Runtime boundary

The local runtime exposes:

- model loading with explicit local paths;
- tokenizer encode/decode;
- local text generation;
- local embeddings;
- cosine similarity;
- local cross-encoder reranking;
- model disposal and cache management.

The grounded adapter accepts evidence from the existing search layer, optionally reranks it, and asks the local model to answer only from the supplied evidence.

## Corpus and acquisition safety

The local AI layer does not:

- modify canonical Quran or hadith text;
- promote generated prose into the Corpus;
- change provenance or rights metadata;
- block Rechercher acquisition;
- fetch models automatically;
- make an unknown-weight checksum acceptable.

Model software, weights, conversions, licenses, provenance, and runtime security remain separately reviewable under the engine-evolution control plane.
