# Rechercher AI Engine

Rechercher now owns a provider-neutral AI integration boundary. External projects are replaceable sources of components, protocols and ideas, not authorities over the Corpus.

## Architecture

Vercel AI SDK is treated as an Apache-2.0 interoperability reference. Rechercher does not require Vercel hosting.

Supabase may provide PostgreSQL-compatible operational storage, metadata, indexes and vectors. It is never the authoritative Corpus.

PostHog is optional observability. The Enterprise-only ee tree is excluded; use MIT/FOSS-compatible components only.

Free.ai is optional coding/model infrastructure. Model licenses are recorded individually. No hosted-service key is committed.

## Secrets

Never commit API keys, service-role keys, tokens or passwords. Runtime variables are expected for optional integrations:

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- POSTHOG_HOST
- POSTHOG_PROJECT_API_KEY
- provider-specific keys

## Corpus boundary

AI may read, discover, classify, analyze and propose. It cannot write directly to the Corpus, decide redistribution rights, silently replace provenance, or rewrite canonical Quran Arabic or source text.

Promotion continues through existing provenance, rights, validation and review gates.

## Third-party intake ledger

Before copying a third-party source file, record upstream repository, exact path, commit or tag, SPDX license, copyright notices, modifications and dependency licenses. Prefer clean-room adapters over copying large upstream trees.
