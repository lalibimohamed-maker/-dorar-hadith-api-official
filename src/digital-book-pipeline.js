/**
 * Rights-aware, lossless digital-book pipeline contract.
 *
 * This module deliberately does not perform OCR/PDF/DOCX conversion itself.
 * It defines the immutable source + derived representation contract that
 * adapters (OCR, PDF, DOCX, renderers/exporters) must obey.
 */

import { createHash } from 'node:crypto';

const REDISTRIBUTABLE = new Set(['public-domain', 'cc-by', 'cc-by-sa', 'explicit-redistribution']);
const PRESENTATION_MODES = new Set(['paper', 'light', 'dark', 'sepia']);

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

export function canExport(source, format) {
  const normalizedFormat = String(format).toLowerCase();
  return ['pdf', 'docx'].includes(normalizedFormat) && REDISTRIBUTABLE.has(source?.rights);
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
