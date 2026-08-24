/**
 * Rights-aware, lossless digital-book pipeline contract.
 *
 * This module does not perform OCR/PDF/DOCX conversion itself. It defines
 * the immutable source + derived representation contract that adapters
 * (OCR engines, alignment, renderers and exporters) must obey.
 */

import { createHash } from 'node:crypto';
import { RIGHTS } from './book-rights-resolver.js';

const PRESENTATION_MODES = new Set(['paper', 'light', 'dark', 'sepia']);
const EXPORT_FORMATS = new Set(['pdf', 'docx', 'epub', 'pptx']);
const REDISTRIBUTABLE_RIGHTS = new Set([RIGHTS.REDISTRIBUTABLE]);

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function createBookSource({ id, title, sourceUrl, mediaType, bytes, rights }) {
  if (!id || !title || !sourceUrl || !mediaType || !rights) throw new Error('Book source requires identity, source, media type, and rights');
  if (!Buffer.isBuffer(bytes)) throw new TypeError('Book source bytes must be a Buffer');
  return Object.freeze({
    id,
    title,
    sourceUrl,
    mediaType,
    rights,
    sourceSha256: sha256(bytes),
    immutable: true,
  });
}

export function createDigitalRepresentation({ source, pages, extraction }) {
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

/**
 * Multi-OCR evidence is a derived comparison layer. It never silently
 * replaces the source. At least two independent OCR engines are required
 * before alignment can be promoted to a digital master.
 */
export function evaluateOcrAlignment({ source, engines = [], alignment }) {
  const failures = [];
  if (!source?.immutable || !source.sourceSha256) failures.push('immutable_source_required');
  if (!Array.isArray(engines) || engines.length < 2) failures.push('multi_ocr_required');
  if (new Set(engines.map((engine) => engine?.id).filter(Boolean)).size < 2) failures.push('independent_ocr_engines_required');
  if (alignment?.sourceSha256 !== source?.sourceSha256) failures.push('alignment_source_mismatch');
  if (alignment?.status !== 'aligned') failures.push('alignment_required');
  return failures.length ? { allowed: false, state: 'blocked', failures } : { allowed: true, state: 'aligned', failures: [] };
}

export function createDigitalMaster({ source, alignment, pages }) {
  const gate = evaluateOcrAlignment({ source, engines: alignment?.engines, alignment });
  if (!gate.allowed) throw new Error(`Digital master blocked: ${gate.failures.join(',')}`);
  const representation = createDigitalRepresentation({ source, pages, extraction: 'multi-ocr-aligned' });
  return Object.freeze({
    id: `${source.id}:digital-master`,
    sourceId: source.id,
    sourceSha256: source.sourceSha256,
    representation,
    status: 'validated-derived',
  });
}

/**
 * Export is an authorization gate, not a presentation decision.
 * Read-only, read-copy, link-only, unclear and restricted books can never
 * reach a redistribution export.
 */
export function canExport(source, format) {
  const normalizedFormat = String(format).toLowerCase();
  return EXPORT_FORMATS.has(normalizedFormat) && REDISTRIBUTABLE_RIGHTS.has(source?.rights);
}

export function readingTheme(mode = 'paper') {
  if (!PRESENTATION_MODES.has(mode)) throw new Error(`Unsupported reading theme: ${mode}`);
  return {
    mode,
    // Presentation only: never modifies the underlying book text.
    background: mode === 'paper' || mode === 'sepia' ? '#f6edcf' : null,
    sectionAccent: 'presentation-only',
    textLayerImmutable: true,
  };
}

export function validateDigitalRepresentation(source, representation) {
  if (representation.sourceId !== source.id) return false;
  if (representation.sourceSha256 !== source.sourceSha256) return false;
  return representation.pages.every((page, index) => page.number === index + 1 && page.text !== undefined);
}
