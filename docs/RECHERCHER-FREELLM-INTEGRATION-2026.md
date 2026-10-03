# Rechercher + FreeLLM integration

The canonical FreeLLM entry point is **https://freellm.net/**.

Tracking parameters such as `?utm_source=chatgpt.com` are treated as presentation-only and are stripped before a URL enters the registry. The integration records these canonical sources:

- `https://freellm.net/` — directory home/current inventory signal.
- `https://freellm.net/models/` — searchable model directory.
- `https://freellm.net/llms.txt` — preferred agent navigation/index document.
- `https://freellm.net/free-llm-api-status` — freshness/availability signal, not runtime authority.

FreeLLM describes its directory as a daily-refreshed catalog of free/trial LLM APIs and publishes current model/provider/status information. The registry therefore treats it as **discovery and freshness evidence**, not as the authority for API execution, weight licensing or model redistribution.

## Boundaries

- FreeLLM discovers current free/trial API offerings.
- The upstream provider remains authoritative for API behavior.
- The upstream model card remains authoritative for weight licensing and redistribution.
- The FreeLLM status page is a freshness signal; it does not grant runtime admission.
- `llms.txt` is agent navigation metadata; it is not a model-weight manifest.
- Local/offline mode never silently promotes to a remote FreeLLM provider.
- API keys remain user secrets and are never placed in repository configuration.
- No canonical Corpus data is changed.

## Weight path

An open-weight entry may produce a candidate weight target, but acquisition happens only when an explicit target is declared in the separate weight manifest.

Approved weights are downloaded, checksum-verified and runtime-verified by CI, then stored as GitHub Release assets. Git LFS and repository binary persistence are not used.

## Current concrete bootstrap target

The first small local reasoning target is Qwen/Qwen3-0.6B, independently verified from its Hugging Face model card as Apache-2.0 and approximately 1.52 GB. The FreeLLM registry supplies discovery of free remote alternatives; it does not replace the upstream license/weight evidence.

This keeps discovery, acquisition, runtime admission and scholarly Corpus integrity as separate layers.
