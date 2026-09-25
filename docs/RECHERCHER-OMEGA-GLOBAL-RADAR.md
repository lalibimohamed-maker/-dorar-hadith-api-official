# Rechercher Ω — Global Deep Research Radar

The Global Deep Research Radar is the research/search-provider layer above the
existing execution router.

## Provider lanes

- **Jina Reader** — no-key URL reading path. The provider is useful for turning
  discovered pages into LLM-friendly text; it is a research input, not scholarly
  evidence by itself.
- **SearXNG** — self-hosted/open search aggregation. Rechercher reads its URL
  from `SEARXNG_URL`; no public instance is hard-coded, so the project does
  not depend on an unknown third-party instance.
- **Jina DeepSearch** — represented as a free UI research lane, but explicitly
  marked `ui_only`. Rechercher never claims that a consumer UI is an API and
  never automates it through this registry.
- **Brave Search API** — bounded free-credit lane. The current provider offers
  $5 of monthly credits, but it is not modeled as unlimited free access.
  Rechercher requires `BRAVE_SEARCH_API_KEY` and never enables paid fallback.

## Routing policy

1. Prefer no-key/free-local providers.
2. Optionally include explicitly bounded free-credit providers.
3. Exclude UI-only products from automation.
4. Never silently switch to paid execution.
5. Never write radar results directly into Corpus.
6. Health checks are metadata-only and perform no network requests.

## Worldwide coverage

The radar is intentionally provider-agnostic. Its output can feed the existing
Global and country source registries, including official and regional sources.
A provider finding is only a discovery signal. Rights, provenance, source
identity and scholarly evidence gates remain separate.

## Why SearXNG is included

SearXNG is free software and can be self-hosted, with many search services
aggregated behind one installation. A private/local instance is preferred over
hard-coding a public instance.

## Why Brave is bounded

Brave's current API documentation advertises $5 in free monthly credits. That
credit is treated as a strict free-credit budget; the radar does not authorize
additional spending.

## Security boundary

The radar does not store credentials, generated media, or raw research output.
Credential values must be injected only at runtime by the execution layer.
