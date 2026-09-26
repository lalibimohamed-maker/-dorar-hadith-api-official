# Rechercher Ω — provider-neutral AI integration

This is a component layer **inside Rechercher Ω**, not a second AI engine or a second orchestration branch. Ω remains the single canonical AI intelligence kernel for Rechercher.

## Architecture

Rechercher Ω owns model selection, task routing, evidence gates, rights gates, provenance and the Corpus boundary. The provider-neutral layer supplies replaceable adapters and optional operational integrations.

Vercel AI SDK is treated as an Apache-2.0 interoperability reference. Rechercher does not require Vercel hosting.

Supabase may provide PostgreSQL-compatible operational storage, metadata, indexes and vectors. It is never the authoritative Corpus.

PostHog is optional observability. The Enterprise-only `ee` tree is excluded; use MIT/FOSS-compatible components only.

Free.ai is optional model/provider infrastructure. Model licenses are recorded individually and must not override Ω's license/rights gates.

## Secrets

Never commit API keys, service-role keys, tokens or passwords. Runtime variables are expected for optional integrations:

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- POSTHOG_HOST
- POSTHOG_PROJECT_API_KEY
- provider-specific keys

Keys are credentials, not source code and are never copied into the repository.

## Corpus boundary

AI may read, discover, classify, analyze and propose. It cannot write directly to the Corpus, decide redistribution rights, silently replace provenance, or rewrite canonical Quran Arabic or source text.

Generated media remains non-authoritative and cannot become scholarly evidence merely because an AI provider produced it.

Promotion continues through Ω provenance, rights, validation and review gates.

## Third-party intake ledger

Before copying a third-party source file, record upstream repository, exact path, commit or tag, SPDX license, copyright notices, modifications and dependency licenses. Prefer clean-room adapters over copying large upstream trees.

## Single-engine rule

There is one Rechercher AI engine: **Rechercher Ω**. Provider adapters, model catalogs and optional stores under this layer are implementation modules of Ω and must not create a separate PR/branch-level AI engine.
