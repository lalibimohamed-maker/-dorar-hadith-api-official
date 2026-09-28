/**
 * Rights-aware, lossless digital-book pipeline contract.
 *
 * This module is contract-only: adapters may fetch, OCR, align and export,
 * but they must prove each gate before crossing it. The immutable source is
 * never replaced by a derived representation.
 */

import { createHash } from 'node:crypto';

const PRESENTATION_MODES = new Set(['paper', 'light', 'dark', 'sepia']);
const EXPORT_FORMATS = new Set(['pdf', 'docx', 'epub', 'pptx']);
const REDISTRIBUTABLE_RIGHTS = new Set(['redistributable', 'licensed', 'public-domain']);
const BLOCKED_RIGHTS = new Set(['restricted', 'read-only', 'link-only', 'rights-unclear', 'read-copy']);

export const DIGITAL_BOOK_PIPELINE = Object.freeze([
  'search',
  'source',
  'provenance',
  'rights',
  'fetch',
  'immutable_source',
  'multi_ocr',
  'alignment',
  'validation',
  'digital_master',
  'export'
]);

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function rightsStatus(value) {
  return String(value?.status ?? value ?? '').trim().toLowerCase();
}

function validHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function evaluateBookFetchGate({ source, provenance, rights } = {}) {
  const failures = [];
  if (!source?.id || !validHttpUrl(source?.sourceUrl ?? source?.url)) failures.push('source_required');
  if (!provenance?.sourceId || !provenance?.verifiedAt) failures.push('provenance_required');

  const status = rightsStatus(rights);
  if (!REDISTRIBUTABLE_RIGHTS.has(status)) {
    failures.push(BLOCKED_RIGHTS.has(status) ? `rights_blocked:${status}` : 'rights_not_verified');
  }

  return Object.freeze({
    allowed: failures.length === 0,
    state: failures.length ? 'blocked' : 'fetchable',
    failures
  });
}

export function createBookSource({ id, title, sourceUrl, mediaType, bytes, rights, provenance } = {}) {
  if (!id || !title || !sourceUrl || !mediaType || !rights) throw new Error('Book source requires identity, source, media type, and rights');
  if (!validHttpUrl(sourceUrl)) throw new Error('Book source requires an HTTP(S) source URL');
  if (!Buffer.isBuffer(bytes)) throw new TypeError('Book source bytes must be a Buffer');
  if (!provenance?.sourceId || !provenance?.verifiedAt) throw new Error('Book source requires verified provenance');

  const fetchGate = evaluateBookFetchGate({ source: { id, sourceUrl }, provenance, rights });
  if (!fetchGate.allowed) throw new Error(`Book source blocked: ${fetchGate.failures.join(',')}`);

  return Object.freeze({
    id,
    title,
    sourceUrl,
    mediaType,
    rights,
    provenance: Object.freeze({ ...provenance }),
    sourceSha256: sha256(bytes),
    immutable: true,
    derived: false,
  });
}

export function createDigitalRepresentation({ source, pages, extraction } = {}) {
  if (!source?.immutable || !source.sourceSha256) throw new Error('Digital representation requires an immutable source');
  if (!Array.isArray(pages) || pages.length === 0) throw new Error('Digital representation requires ordered pages');

  const normalizedPages = pages.map((page, index) => ({
    number: page.number ?? index + 1,
    text: page.text ?? '',
    sourcePageHash: page.sourcePageHash ?? null,
    extraction: extraction ?? 'source-text',
    confidence: page.confidence ?? 1,
    verified: Boolean(page.verified),
  }));

  return Object.freeze({
    sourceId: source.id,
    sourceSha256: source.sourceSha256,
    pages: Object.freeze(normalizedPages),
    textPreservation: 'source-is-authority',
    derived: extraction !== 'source-text',
  });
}

export function evaluateOcrAlignment({ source, engines = [], alignment } = {}) {
  const failures = [];
  if (!source?.immutable || !source.sourceSha256) failures.push('immutable_source_required');
  if (!Array.isArray(engines) || engines.length < 2) failures.push('multi_ocr_required');

  const independent = Array.isArray(engines)
    ? engines.filter((engine) => engine?.id && engine.independent === true)
    : [];
  if (new Set(independent.map((engine) => engine.id)).size < 2) failures.push('independent_ocr_engines_required');

  if (alignment?.sourceSha256 !== source?.sourceSha256) failures.push('alignment_source_mismatch');
  if (alignment?.status !== 'aligned') failures.push('alignment_required');

  const unresolved = Array.isArray(alignment?.unresolvedDifferences)
    ? alignment.unresolvedDifferences.length
    : Number(alignment?.unresolvedDifferences || 0);
  if (unresolved > 0) failures.push('unresolved_alignment_differences');

  return failures.length
    ? { allowed: false, state: 'blocked', failures }
    : { allowed: true, state: 'aligned', failures: [] };
}

export function createDigitalMaster({ source, alignment, pages, validation } = {}) {
  const gate = evaluateOcrAlignment({ source, engines: alignment?.engines, alignment });
  if (!gate.allowed) throw new Error(`Digital master blocked: ${gate.failures.join(',')}`);
  if (validation?.status !== 'valid') throw new Error('Digital master blocked: validation_required');

  const representation = createDigitalRepresentation({
    source,
    pages,
    extraction: 'multi-ocr-aligned'
  });

  return Object.freeze({
    id: `${source.id}:digital-master`,
    sourceId: source.id,
    sourceSha256: source.sourceSha256,
    representation,
    status: 'validated-derived',
    sourceImmutable: true,
    canonicalTextMutated: false,
  });
}

export function canExport(source, format) {
  const normalizedFormat = String(format).toLowerCase();
  return EXPORT_FORMATS.has(normalizedFormat) && REDISTRIBUTABLE_RIGHTS.has(rightsStatus(source?.rights));
}

export function readingTheme(mode = 'paper') {
  if (!PRESENTATION_MODES.has(mode)) throw new Error(`Unsupported reading theme: ${mode}`);
  return {
    mode,
    background: mode === 'paper' || mode === 'sepia' ? '#f6edcf' : null,
    sectionAccent: 'presentation-only',
    textLayerImmutable: true,
  };
}

export function validateDigitalRepresentation(source, representation) {
  if (!representation?.sourceId || representation.sourceId !== source.id) return false;
  if (representation.sourceSha256 !== source.sourceSha256) return false;
  return representation.pages.every((page, index) => page.number === index + 1 && page.text !== undefined);
}

/**
 * Build a deterministic bulk-download plan from catalog records.
 * No network access occurs here. Every edition is rights-checked independently.
 */
export function planBulkBookDownload({ books = [], formats = ['pdf'] } = {}) {
  const requestedFormats = [...new Set(formats.map((format) => String(format).toLowerCase()))];
  const invalidFormats = requestedFormats.filter((format) => !EXPORT_FORMATS.has(format));
  if (invalidFormats.length) throw new Error(`Unsupported export format: ${invalidFormats.join(',')}`);

  const seen = new Set();
  const allowed = [];
  const blocked = [];

  for (const book of books) {
    const editionId = String(book.editionId ?? book.id ?? '').trim();
    if (!editionId || seen.has(editionId)) continue;
    seen.add(editionId);

    const rights = rightsStatus(book.rights);
    const permitted = REDISTRIBUTABLE_RIGHTS.has(rights) && book.provenance && book.source;
    const entry = {
      editionId,
      bookId: book.id ?? null,
      title: book.title ?? null,
      author: book.author ?? null,
      source: book.source ?? null,
      provenance: book.provenance ?? null,
      rights: book.rights ?? null,
      formats: requestedFormats
    };

    if (permitted) allowed.push(entry);
    else blocked.push({
      ...entry,
      formats: [],
      referenceOnly: true,
      reason: BLOCKED_RIGHTS.has(rights) ? `rights_blocked:${rights}` : 'rights_or_provenance_not_ready'
    });
  }

  return Object.freeze({
    requestedFormats,
    discoveredEditions: seen.size,
    duplicateEditionsRemoved: books.length - seen.size,
    allowed,
    blocked,
    networkFetchPerformed: false,
    corpusMutation: false
  });
}
