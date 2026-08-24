import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canExport,
  createBookSource,
  createDigitalMaster,
  createDigitalRepresentation,
  evaluateOcrAlignment,
  readingTheme,
  validateDigitalRepresentation,
} from '../src/digital-book-pipeline.js';
import { RIGHTS } from '../src/book-rights-resolver.js';

const bytes = Buffer.from('immutable source artifact');

function source(rights = RIGHTS.REDISTRIBUTABLE) {
  return createBookSource({
    id: 'book-1',
    title: 'Example Book',
    sourceUrl: 'https://example.invalid/book',
    mediaType: 'application/pdf',
    bytes,
    rights,
  });
}

const engines = [{ id: 'ocr-a' }, { id: 'ocr-b' }];

test('source keeps an immutable SHA-256 identity', () => {
  const value = source();
  assert.equal(value.immutable, true);
  assert.equal(value.sourceSha256.length, 64);
});

test('digital representation preserves page order and source identity', () => {
  const value = source();
  const representation = createDigitalRepresentation({
    source: value,
    pages: [
      { number: 1, text: 'First page', sourcePageHash: 'a', verified: true },
      { number: 2, text: 'Second page', sourcePageHash: 'b', verified: true },
    ],
    extraction: 'pdf-text',
  });
  assert.equal(validateDigitalRepresentation(value, representation), true);
  assert.equal(representation.derived, true);
});

test('multi-OCR alignment requires two independent engines', () => {
  const value = source();
  assert.equal(evaluateOcrAlignment({ source: value, engines: [{ id: 'ocr-a' }], alignment: { status: 'aligned', sourceSha256: value.sourceSha256 } }).allowed, false);
  assert.equal(evaluateOcrAlignment({ source: value, engines, alignment: { status: 'aligned', sourceSha256: value.sourceSha256 } }).allowed, true);
});

test('digital master cannot be created from mismatched alignment', () => {
  const value = source();
  assert.throws(() => createDigitalMaster({
    source: value,
    alignment: { status: 'aligned', sourceSha256: 'wrong', engines },
    pages: [{ number: 1, text: 'page' }],
  }), /Digital master blocked/);
});

test('digital master remains derived from the immutable source', () => {
  const value = source();
  const master = createDigitalMaster({
    source: value,
    alignment: { status: 'aligned', sourceSha256: value.sourceSha256, engines },
    pages: [{ number: 1, text: 'page', verified: true }],
  });
  assert.equal(master.sourceSha256, value.sourceSha256);
  assert.equal(master.status, 'validated-derived');
});

test('export is blocked unless redistribution rights are explicit', () => {
  assert.equal(canExport(source(RIGHTS.REDISTRIBUTABLE), 'pdf'), true);
  assert.equal(canExport(source(RIGHTS.REDISTRIBUTABLE), 'docx'), true);
  assert.equal(canExport(source(RIGHTS.REDISTRIBUTABLE), 'epub'), true);
  assert.equal(canExport(source(RIGHTS.RESTRICTED), 'pdf'), false);
  assert.equal(canExport(source(RIGHTS.RESTRICTED), 'docx'), false);
});

test('reading themes are presentation-only and do not alter text', () => {
  const theme = readingTheme('sepia');
  assert.equal(theme.textLayerImmutable, true);
  assert.equal(theme.sectionAccent, 'presentation-only');
});
