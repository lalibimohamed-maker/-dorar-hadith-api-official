import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canExport,
  createBookSource,
  createDigitalMaster,
  createDigitalRepresentation,
  evaluateBookFetchGate,
  evaluateOcrAlignment,
  planBulkBookDownload,
  readingTheme,
  validateDigitalRepresentation,
} from '../src/digital-book-pipeline.js';
import { RIGHTS } from '../src/book-rights-resolver.js';

const bytes = Buffer.from('immutable source artifact');
const provenance = {
  sourceId: 'official-source',
  verifiedAt: '2026-08-24T00:00:00Z',
  edition: 'edition-1',
};

function source(rights = RIGHTS.REDISTRIBUTABLE) {
  return createBookSource({
    id: 'book-1',
    title: 'Example Book',
    sourceUrl: 'https://example.invalid/book',
    mediaType: 'application/pdf',
    bytes,
    rights,
    provenance,
  });
}

const engines = [
  { id: 'ocr-a', independent: true },
  { id: 'ocr-b', independent: true }
];

test('fetch gate requires source, provenance and redistribution rights', () => {
  assert.equal(evaluateBookFetchGate({
    source: { id: 'book-1', sourceUrl: 'https://example.invalid/book' },
    provenance,
    rights: RIGHTS.REDISTRIBUTABLE
  }).allowed, true);

  for (const rights of [RIGHTS.RESTRICTED, RIGHTS.READ_ONLY, RIGHTS.LINK_ONLY, RIGHTS.RIGHTS_UNCLEAR]) {
    assert.equal(evaluateBookFetchGate({
      source: { id: 'book-1', sourceUrl: 'https://example.invalid/book' },
      provenance,
      rights
    }).allowed, false);
  }
});

test('source keeps an immutable SHA-256 identity and provenance', () => {
  const value = source();
  assert.equal(value.immutable, true);
  assert.equal(value.derived, false);
  assert.equal(value.sourceSha256.length, 64);
  assert.equal(value.provenance.sourceId, provenance.sourceId);
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

test('multi-OCR alignment requires two independent engines and source fingerprint', () => {
  const value = source();
  assert.equal(evaluateOcrAlignment({
    source: value,
    engines: [{ id: 'ocr-a', independent: true }],
    alignment: { status: 'aligned', sourceSha256: value.sourceSha256 }
  }).allowed, false);

  assert.equal(evaluateOcrAlignment({
    source: value,
    engines,
    alignment: { status: 'aligned', sourceSha256: value.sourceSha256 }
  }).allowed, true);

  assert.equal(evaluateOcrAlignment({
    source: value,
    engines,
    alignment: { status: 'aligned', sourceSha256: value.sourceSha256, unresolvedDifferences: ['page-7'] }
  }).allowed, false);
});

test('digital master requires successful validation after alignment', () => {
  const value = source();
  assert.throws(() => createDigitalMaster({
    source: value,
    alignment: { status: 'aligned', sourceSha256: value.sourceSha256, engines },
    validation: { status: 'pending_verification' },
    pages: [{ number: 1, text: 'page' }],
  }), /validation_required/);
});

test('digital master cannot be created from mismatched alignment', () => {
  const value = source();
  assert.throws(() => createDigitalMaster({
    source: value,
    alignment: { status: 'aligned', sourceSha256: 'wrong', engines },
    validation: { status: 'valid' },
    pages: [{ number: 1, text: 'page' }],
  }), /Digital master blocked/);
});

test('digital master remains derived from the immutable source', () => {
  const value = source();
  const master = createDigitalMaster({
    source: value,
    alignment: { status: 'aligned', sourceSha256: value.sourceSha256, engines },
    validation: { status: 'valid' },
    pages: [{ number: 1, text: 'page', verified: true }],
  });
  assert.equal(master.sourceSha256, value.sourceSha256);
  assert.equal(master.status, 'validated-derived');
  assert.equal(master.sourceImmutable, true);
  assert.equal(master.canonicalTextMutated, false);
});

test('export supports redistribution-permitted derived formats only', () => {
  for (const format of ['pdf', 'docx', 'epub', 'pptx']) {
    assert.equal(canExport(source(RIGHTS.REDISTRIBUTABLE), format), true);
  }

  assert.equal(canExport(source('licensed'), 'pdf'), true);
  assert.equal(canExport(source('public-domain'), 'epub'), true);
  assert.equal(canExport(source(RIGHTS.RESTRICTED), 'pdf'), false);
  assert.equal(canExport(source(RIGHTS.READ_ONLY), 'docx'), false);
  assert.equal(canExport(source(RIGHTS.LINK_ONLY), 'pptx'), false);
  assert.equal(canExport(source(RIGHTS.RIGHTS_UNCLEAR), 'epub'), false);
});

test('bulk download plan deduplicates editions and leaves blocked books reference-only', () => {
  const plan = planBulkBookDownload({
    books: [
      { id: 'b1', editionId: 'e1', title: 'Book 1', rights: RIGHTS.REDISTRIBUTABLE, source: { id: 's1' }, provenance },
      { id: 'b1-duplicate', editionId: 'e1', rights: RIGHTS.REDISTRIBUTABLE, source: { id: 's1' }, provenance },
      { id: 'b2', editionId: 'e2', title: 'Book 2', rights: RIGHTS.RESTRICTED, source: { id: 's2' }, provenance },
      { id: 'b3', editionId: 'e3', title: 'Book 3', rights: RIGHTS.RIGHTS_UNCLEAR, source: { id: 's3' }, provenance }
    ],
    formats: ['pdf', 'docx']
  });

  assert.equal(plan.discoveredEditions, 3);
  assert.equal(plan.duplicateEditionsRemoved, 1);
  assert.equal(plan.allowed.length, 1);
  assert.deepEqual(plan.allowed[0].formats, ['pdf', 'docx']);
  assert.equal(plan.blocked.length, 2);
  assert.equal(plan.blocked[0].referenceOnly, true);
  assert.deepEqual(plan.blocked[0].formats, []);
  assert.equal(plan.networkFetchPerformed, false);
  assert.equal(plan.corpusMutation, false);
});

test('reading themes are presentation-only and do not alter text', () => {
  const theme = readingTheme('sepia');
  assert.equal(theme.textLayerImmutable, true);
  assert.equal(theme.sectionAccent, 'presentation-only');
});
