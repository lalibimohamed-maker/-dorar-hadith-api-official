import test from 'node:test';
import assert from 'node:assert/strict';
import {
  contentCacheKey,
  editionCacheKey,
  translationCacheKey,
  derivedArtifactCacheKey,
  mediaVariantCacheKey,
  studyHistoryRecord,
  resolveCachePolicy,
  storageModel,
} from '../src/cache/global-content-cache.mjs';

test('content identity is content-addressed', () => {
  assert.notEqual(contentCacheKey({ contentHash: 'a' }), contentCacheKey({ contentHash: 'b' }));
  assert.equal(editionCacheKey({ contentHash: 'a', editionId: '1' }), editionCacheKey({ contentHash: 'a', editionId: '1' }));
});

test('translation cache is isolated by language and model version', () => {
  const base = { contentHash: 'h', editionId: 'e', sourceLanguage: 'ar', targetLanguage: 'fr', translationModelVersion: 'm1' };
  assert.equal(translationCacheKey(base), translationCacheKey(base));
  assert.notEqual(translationCacheKey(base), translationCacheKey({ ...base, targetLanguage: 'en' }));
  assert.notEqual(translationCacheKey(base), translationCacheKey({ ...base, translationModelVersion: 'm2' }));
});

test('derived artifacts are isolated by pipeline and format', () => {
  const base = { contentHash: 'h', processingPipelineVersion: 'p1', outputFormat: 'pdf' };
  assert.notEqual(derivedArtifactCacheKey(base), derivedArtifactCacheKey({ ...base, outputFormat: 'docx' }));
  assert.notEqual(derivedArtifactCacheKey(base), derivedArtifactCacheKey({ ...base, processingPipelineVersion: 'p2' }));
});

test('media variants are isolated', () => {
  const base = { contentHash: 'h', mediaType: 'video', variant: '720p', codecVersion: 'v1' };
  assert.notEqual(mediaVariantCacheKey(base), mediaVariantCacheKey({ ...base, variant: '1080p' }));
});

test('history is application-scoped and directly reopenable by content id', () => {
  const row = studyHistoryRecord({
    timestamp: '2026-08-30T07:00:00+01:00',
    localDate: '2026-08-30',
    localTime: '07:00:00',
    contentId: 'book-123',
    contentType: 'book',
    editionId: 'readable-yellow-paper-v1',
    language: 'ar',
    route: '/books/book-123',
    title: 'Example',
    position: 120,
    durationViewed: 45,
  });
  assert.equal(row.contentId, 'book-123');
  assert.equal(row.language, 'ar');
  assert.equal(Object.isFrozen(row), true);
});

test('cache policies separate immutable, refreshable and authoritative data', () => {
  assert.equal(resolveCachePolicy({ immutable: true }), 'cache-first');
  assert.equal(resolveCachePolicy({ refreshable: true }), 'stale-while-revalidate');
  assert.equal(resolveCachePolicy({ authoritative: true }), 'network-first-with-cache-fallback');
});

test('storage layers match browser capabilities', () => {
  assert.equal(storageModel.responseCache, 'CacheStorage');
  assert.equal(storageModel.structuredMetadata, 'IndexedDB');
  assert.equal(storageModel.largeBinary, 'OPFS');
});
