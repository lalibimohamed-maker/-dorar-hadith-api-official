const VERSION = 'global-content-cache-2026-08-30';

function requirePart(name, value) {
  if (value === undefined || value === null || value === '') {
    throw new TypeError(`${name} is required`);
  }
  return String(value);
}

export function contentCacheKey({ contentHash }) {
  return `${VERSION}:content:${requirePart('contentHash', contentHash)}`;
}

export function editionCacheKey({ contentHash, editionId }) {
  return `${VERSION}:edition:${requirePart('contentHash', contentHash)}:${requirePart('editionId', editionId)}`;
}

export function translationCacheKey({ contentHash, editionId = 'default', sourceLanguage, targetLanguage, translationModelVersion }) {
  return [
    VERSION,
    'translation',
    requirePart('contentHash', contentHash),
    requirePart('editionId', editionId),
    requirePart('sourceLanguage', sourceLanguage),
    requirePart('targetLanguage', targetLanguage),
    requirePart('translationModelVersion', translationModelVersion),
  ].join(':');
}

export function derivedArtifactCacheKey({ contentHash, processingPipelineVersion, outputFormat }) {
  return [
    VERSION,
    'derived',
    requirePart('contentHash', contentHash),
    requirePart('processingPipelineVersion', processingPipelineVersion),
    requirePart('outputFormat', outputFormat),
  ].join(':');
}

export function mediaVariantCacheKey({ contentHash, mediaType, variant, codecVersion }) {
  return [
    VERSION,
    'media',
    requirePart('contentHash', contentHash),
    requirePart('mediaType', mediaType),
    requirePart('variant', variant),
    requirePart('codecVersion', codecVersion),
  ].join(':');
}

export function studyHistoryRecord({
  timestamp,
  localDate,
  localTime,
  contentId,
  contentType,
  editionId,
  language,
  route,
  title,
  position,
  durationViewed,
  sourceUrl,
}) {
  const record = {
    timestamp: requirePart('timestamp', timestamp),
    localDate: requirePart('localDate', localDate),
    localTime: requirePart('localTime', localTime),
    contentId: requirePart('contentId', contentId),
    contentType: requirePart('contentType', contentType),
    editionId: editionId == null ? 'default' : String(editionId),
    language: requirePart('language', language),
    route: requirePart('route', route),
    title: title == null ? null : String(title),
    position: position == null ? null : Number(position),
    durationViewed: durationViewed == null ? 0 : Number(durationViewed),
    sourceUrl: sourceUrl == null ? null : String(sourceUrl),
    schemaVersion: 1,
  };
  return Object.freeze(record);
}

export function resolveCachePolicy({ immutable = false, refreshable = false, authoritative = false } = {}) {
  if (authoritative) return 'network-first-with-cache-fallback';
  if (immutable) return 'cache-first';
  if (refreshable) return 'stale-while-revalidate';
  return 'network-first-with-cache-fallback';
}

export const storageModel = Object.freeze({
  responseCache: 'CacheStorage',
  structuredMetadata: 'IndexedDB',
  largeBinary: 'OPFS',
  history: 'IndexedDB',
  sharedContent: 'content-addressed-store',
});
