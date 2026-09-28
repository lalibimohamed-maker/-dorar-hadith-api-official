/**
 * Governed book-fetch planner v1.
 *
 * Planning only: no HTTP, storage, parsing, OCR or content inspection.
 * A plan is created only after source-connector, provenance, rights and
 * validation gates have passed and the URL/content metadata is safe.
 */

export const BOOK_FETCH_MAX_BYTES = 25 * 1024 * 1024;

export const ALLOWED_BOOK_FORMATS = Object.freeze({
  pdf: Object.freeze(['application/pdf']),
  text: Object.freeze(['text/plain']),
  epub: Object.freeze(['application/epub+zip', 'application/epub'])
});

export const FETCH_PLAN_STATES = Object.freeze(['planned', 'blocked']);

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isHttpsUrl(value) {
  try {
    return new URL(String(value || '')).protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeContentType(value) {
  return String(value || '').split(';', 1)[0].trim().toLowerCase();
}

function allowedFormatForContentType(contentType) {
  for (const [format, types] of Object.entries(ALLOWED_BOOK_FORMATS)) {
    if (types.includes(contentType)) return format;
  }
  return null;
}

export function validateBookFetchMetadata({
  url,
  contentType,
  contentLengthBytes,
  format = null
} = {}) {
  const failures = [];
  const normalizedType = normalizeContentType(contentType);
  const inferredFormat = allowedFormatForContentType(normalizedType);

  if (!isHttpsUrl(url)) failures.push('https_url_required');
  if (!normalizedType) failures.push('content_type_required');
  if (!inferredFormat) failures.push('content_type_not_allowed');
  if (!Number.isInteger(contentLengthBytes) || contentLengthBytes < 1) {
    failures.push('content_length_required');
  } else if (contentLengthBytes > BOOK_FETCH_MAX_BYTES) {
    failures.push('content_length_exceeds_25_mib');
  }
  if (format !== null && format !== inferredFormat) {
    failures.push('format_content_type_mismatch');
  }

  return Object.freeze({
    passed: failures.length === 0,
    failures,
    url: String(url || ''),
    contentType: normalizedType,
    contentLengthBytes,
    format: inferredFormat,
    maxBytes: BOOK_FETCH_MAX_BYTES
  });
}

export function planBookFetch({
  sourceConnector,
  source,
  provenance,
  rights,
  validation,
  metadata
} = {}) {
  const failures = [];

  if (sourceConnector?.status !== 'passed' || sourceConnector?.verified !== true) {
    failures.push('source_connector_not_passed');
  }
  if (!source?.sourceId || !source?.resourceId) {
    failures.push('source_identity_missing');
  }

  if (!provenance ||
      !nonEmpty(provenance.sourceId) ||
      !nonEmpty(provenance.resourceId) ||
      !nonEmpty(provenance.verifiedAt)) {
    failures.push('provenance_not_verified');
  }

  if (!rights ||
      !['redistributable', 'licensed', 'public-domain'].includes(rights.status)) {
    failures.push('rights_not_clear');
  }

  if (validation?.status !== 'passed') {
    failures.push('validation_not_passed');
  }

  const metadataResult = validateBookFetchMetadata(metadata || {});
  failures.push(...metadataResult.failures);

  const uniqueFailures = [...new Set(failures)];

  if (uniqueFailures.length) {
    return Object.freeze({
      state: 'blocked',
      allowed: false,
      failures: uniqueFailures,
      maxBytes: BOOK_FETCH_MAX_BYTES,
      execution: 'planning-only',
      performsHttpFetch: false,
      writesStorage: false,
      inspectsContent: false
    });
  }

  return Object.freeze({
    state: 'planned',
    allowed: true,
    failures: [],
    maxBytes: BOOK_FETCH_MAX_BYTES,
    execution: 'planning-only',
    performsHttpFetch: false,
    writesStorage: false,
    inspectsContent: false,
    sourceId: source.sourceId,
    resourceId: source.resourceId,
    provenanceId: provenance.resourceId,
    rightsStatus: rights.status,
    url: metadataResult.url,
    contentType: metadataResult.contentType,
    contentLengthBytes: metadataResult.contentLengthBytes,
    format: metadataResult.format
  });
}

export function governedBookFetchPolicy() {
  return Object.freeze({
    maxBytes: BOOK_FETCH_MAX_BYTES,
    maxMiB: 25,
    allowedFormats: ['pdf', 'text', 'epub'],
    allowedContentTypes: Object.fromEntries(
      Object.entries(ALLOWED_BOOK_FORMATS).map(([format, types]) => [format, [...types]])
    ),
    requiresSourceConnector: true,
    requiresProvenance: true,
    requiresRedistributionRights: true,
    requiresValidation: true,
    failClosed: true,
    networkExecution: false,
    storageExecution: false,
    contentInspection: false,
    downstreamLayersMustNotBypassGates: true
  });
}
