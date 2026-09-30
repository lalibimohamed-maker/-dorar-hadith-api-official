# Rechercher Ω — Phase 3

Phase 3 makes execution operational without turning generated output into Corpus truth.

## Runtime gate

Every execution receives a free-first gate. Paid fallback is disabled. If a free quota/provider is unavailable, the job is queued rather than charged or silently switched.

## Weight verification

A model weight can only be promoted after:
1. the exact artifact is identified;
2. SHA-256 is calculated and matches the manifest;
3. the weight license is explicitly cleared;
4. provenance is recorded.

A public code repository is not treated as automatic permission to redistribute its weights.

## Council

Scholarly use requires independent review roles. The council is deliberately fail-closed:
- researcher
- source auditor
- contrarian
- logic auditor
- media critic
- rights auditor
- synthesizer

At least five independent reviews are required; any blocking review blocks advancement; more than two unresolved flags blocks advancement.

Council approval only means the output may enter the next evidence/rights gate. It does not permit direct Corpus writes.

## Kaggle

Kaggle remains a remote execution backend rather than pretending GitHub Actions supplies a free GPU. Kaggle's CLI supports pushing a kernel and selecting accelerators such as T4/L4/A100 where available. The exact accelerator and availability remain environment dependent.

## Hugging Face

The current Inference Providers interface supports unified routing across providers and exposes provider/model availability. The runtime should use this for provider discovery rather than hard-coding an assumed provider. The project's free-first policy still disables paid fallback. 
