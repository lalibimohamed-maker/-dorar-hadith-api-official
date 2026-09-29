# Parallel Search Governance Network

The main search is the only user-facing search entrypoint. Behind it, provider jobs fan out in parallel to reduce latency and improve discovery coverage.

## Execution path

`User Query → Language Resolution → Main Search → Parallel Provider Jobs → Merge/Deduplicate → Rank/Validate → Answer`

The current execution contract limits concurrent provider jobs to 8 and bounds each provider operation to a short timeout. A failed or slow provider is isolated from the overall response.

Provider output is discovery material. It is not authority merely because a provider returned it. Provenance, rights and validation remain independent gates before content can be ingested, downloaded, embedded or redistributed.

A short-lived process cache may be used for repeat queries, and retry may be used for transient provider failures. Neither mechanism bypasses provenance, rights or validation.

The user receives one normalized search response; internal provider topology, fan-out count and individual connector failures are not exposed as the answer surface.

## Current integration

`unifiedSearch()` fans out to the Dorar hadith search, unified source index, fiqh research, historical research, official institutions, rijal research, scholar research and knowledge context providers. These eight jobs are coordinated under the same concurrency and timeout contract.

The search layer does not mutate canonical Corpus content and does not grant redistribution rights.


## Layered provider network

The provider registry is maintained separately in `config/search-provider-network-2026.json`.

Routing layers are:
- Quran and Quran sciences: specialized Quran sources first, then web.
- Tafsir: specialized tafsir sources first, then web.
- Hadith: specialized hadith sources first, then web.
- Books: book/library connectors first, then web.
- Fatwa: qualified fatwa sources first, then web.
- General in-scope encyclopedia queries: multiple web providers.

The current web candidate registry includes Google, Bing, Brave, Mojeek, Yandex and DuckDuckGo. They are candidates, not automatically activated connectors. Activation requires a provider-approved integration method and current terms review.

No provider is queried by scraping when an official API or other provider-permitted interface is required. Rate limits must be respected and provider-specific storage/cache/retry rules are enforced independently. For example, Brave's current Search API terms prohibit storing or caching Search Results beyond transient operational storage unless the applicable plan explicitly grants storage rights. citeturn761850search0turn761850search4

Provider results remain discovery material and do not become authoritative, canonical Corpus content, or redistributable material merely because they were returned by a search API.


## Neutral provider adapters

The federation runtime does not assume the availability of any specific external search service. Provider names such as Google, Bing, Brave, Mojeek, Yandex, or DuckDuckGo are configuration-level candidates only.

A provider becomes eligible only through the governed adapter contract: an explicit provider ID/class, an official API or other provider-permitted interface, disabled-by-default activation, no scraping, and compliance with the provider's current rate, retention, caching, and retry terms.

Adding a different provider therefore does not require changing the federation algorithm. It requires registering a compliant adapter and enabling it explicitly.
