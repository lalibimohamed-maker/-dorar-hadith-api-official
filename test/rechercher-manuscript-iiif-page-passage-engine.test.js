import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPageRecord,
  alignPassageToPage,
  markPageForReview,
  pagePassageCapabilities,
} from '../src/rechercher-manuscript-iiif-page-passage-engine.js';

test('creates immutable IIIF page identity', () => {
  const page = createPageRecord({
    manifestId: 'manifest:1',
    canvasId: 'canvas:1',
    pageId: 'page:1',
    imageService: 'iiif:image:1',
  });
  assert.equal(page.immutable, true);
  assert.equal(page.state, 'DISCOVERED');
});

test('aligns a passage only with provenance', () => {
  const page = createPageRecord({ manifestId: 'm', canvasId: 'c', pageId: 'p' });
  const aligned = alignPassageToPage(page, {
    passageId: 'passage:1',
    text: 'نص مستخرج',
    provenance: { sourceId: 'source:1', method: 'ocr' },
  });
  assert.equal(aligned.state, 'ALIGNED');
  assert.equal(aligned.passage.reviewState, 'UNREVIEWED');
});

test('rejects passage alignment without provenance', () => {
  const page = createPageRecord({ manifestId: 'm', canvasId: 'c', pageId: 'p' });
  assert.throws(() => alignPassageToPage(page, {
    passageId: 'passage:1',
    text: 'نص مستخرج',
  }), /provenance is required/);
});

test('can route a page to human review', () => {
  const page = createPageRecord({ manifestId: 'm', canvasId: 'c', pageId: 'p' });
  const reviewed = markPageForReview(page, 'OCR confidence below threshold');
  assert.equal(reviewed.state, 'REVIEW_REQUIRED');
});

test('exposes page and passage capabilities', () => {
  assert.deepEqual(pagePassageCapabilities(), [
    'CANVAS_PAGE_IDENTITY',
    'IMAGE_TEXT_ALIGNMENT',
    'PASSAGE_PROVENANCE',
    'OCR_HTR_REVIEW_GATE',
    'IMMUTABLE_PAGE_SOURCE',
  ]);
});
