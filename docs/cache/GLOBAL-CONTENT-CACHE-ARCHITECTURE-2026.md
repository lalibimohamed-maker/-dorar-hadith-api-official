# Global Content Cache Architecture — 2026

## Principle

Free-first: no paid subscription or paid API is required. Cache reuse must happen before remote retrieval or expensive reprocessing whenever a valid verified artifact exists.

## The important distinction

The project uses two complementary cache scopes:

1. **Shared content cache** — reusable, rights-checked, content-addressed artifacts that may serve multiple users.
2. **Per-browser study cache** — local CacheStorage/IndexedDB/OPFS data and an application-owned history calendar. Browser global history is never assumed to be readable by the application.

## Content identity

The source content hash is the stable identity. Derived editions, translations and media variants extend that identity with their edition, pipeline, language, model and codec versions.

This avoids both accidental collisions and stale translations silently being reused after a source/model change.

## Translation reuse

A translation hit requires the same source content hash, source edition, source language, target language and translation-model version. The original source text and provenance remain attached to every translation.

## Browser history/calendar

The application records only navigation/events that occur inside the encyclopedia. The Navigation API can expose same-origin application history entries, while IndexedDB provides durable structured records for a calendar view. The calendar stores a content identifier so reopening a historical entry resolves the cached content first and uses the network only on a cache miss.

## Large books and media

IndexedDB stores structured metadata and indexes. OPFS stores large local binary artifacts efficiently. CacheStorage/Service Worker handles request/response caching and offline routing. Storage quotas are measured and eviction is graceful; source-of-record data is never deleted by browser-cache eviction.

## Cache strategies

- Immutable verified artifacts: **cache-first**.
- Refreshable non-authoritative resources: **stale-while-revalidate**.
- Authoritative source refreshes: **network-first with cache fallback**, followed by verification before promoting the new shared variant.

## Integrity and security

Remote content remains untrusted even after caching. Cached material cannot issue tool commands. Every shared artifact keeps source, rights, license and integrity metadata. Content-addressing is used for deduplication and tamper/change detection.
