# Rechercher + FreeLLM integration

freellm.net is integrated as a **live free-LLM discovery registry**, not as a model-weight authority and not as an automatic inference provider.

## Boundaries

- FreeLLM discovers current free/trial API offerings.
- The upstream provider remains authoritative for API behavior.
- The upstream model card remains authoritative for weight licensing and redistribution.
- Local/offline mode never silently promotes to a remote FreeLLM provider.
- API keys remain user secrets and are never placed in repository configuration.
- No canonical Corpus data is changed.

## Weight path

An open-weight entry may produce a candidate weight target, but acquisition happens only when an explicit target is declared in the separate weight manifest.

Approved weights are downloaded, checksum-verified and runtime-verified by CI, then stored as GitHub Release assets. Git LFS and repository binary persistence are not used.

## Current concrete bootstrap target

The first small local reasoning target is Qwen/Qwen3-0.6B, independently verified from its Hugging Face model card as Apache-2.0 and approximately 1.52 GB. The FreeLLM registry supplies discovery of free remote alternatives; it does not replace the upstream license/weight evidence.

This keeps discovery, acquisition, runtime admission and scholarly Corpus integrity as separate layers.
