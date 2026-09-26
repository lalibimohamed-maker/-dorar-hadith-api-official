# Rechercher Ω — Execution Layer

Execution selection is separate from model selection:

1. select a model worker by task;
2. select an available backend by resource/quota constraints;
3. invoke an adapter;
4. record provenance;
5. pass output through evidence, rights and Corpus gates.

## Adapters

- Local: explicit local command with runtime environment.
- Gemini: REST adapter using GEMINI_API_KEY.
- Groq: OpenAI-compatible REST adapter using GROQ_API_KEY.
- Hugging Face: Inference Providers/OpenAI-compatible REST adapter using HF_TOKEN.
- Kaggle GPU: remote-kernel execution plan.

No credential is serialized into a registry, manifest, provenance record, commit or artifact.

## Weight manifest

config/rechercher-omega-model-weights.json records the official upstream repository while leaving the exact revision and SHA-256 empty until a specific weight object is actually verified.

Runtime download is allowed. Persistent mirroring/public redistribution requires a separate rights decision.

## Free-first behavior

The intended order is local, Gemini, Groq, Hugging Face, then Kaggle, subject to availability and task constraints.

A provider adapter is generated material, not scholarly evidence. It remains outside the scholarly Corpus until independent project gates are satisfied.
