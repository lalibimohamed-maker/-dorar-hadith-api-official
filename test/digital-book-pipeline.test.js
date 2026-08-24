import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canExport,
  createBookSource,
  createDigitalRepresentation,
  readingTheme,
  validateDigitalRepresentation,
} from '../src/digital-book-pipeline.js';

const bytes = Buffer.from('immutable source artifact');

function source(rights = 'public-domain') {
  return createBookSource({
    id: 'book-1',
    title: 'Example Book',
    sourceUrl: 'https://example.invalid/book',
    mediaType: 'application/pdf',
    bytes,
    rights,
  });
}

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
  assert.equal(representation.pages[0].text, 'First page');
});

test('export is blocked unless redistribution rights are explicit', () => {
  assert.equal(canExport(source('public-domain'), 'pdf'), true);
  assert.equal(canExport(source('public-domain'), 'docx'), true);
  assert.equal(canExport(source('restricted'), 'pdf'), false);
  assert.equal(canExport(source('restricted'), 'docx'), false);
});

test('reading themes are presentation-only and do not alter text', () => {
  const theme = readingTheme('sepia');
  assert.equal(theme.textLayerImmutable, true);
  assert.equal(theme.sectionAccent, 'presentation-only');
});
