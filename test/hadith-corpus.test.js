import assert from 'node:assert/strict';
import test from 'node:test';
import { findHadithBook, getHadithCorpusCatalog, listHadithBooks, validateHadithRecord } from '../src/hadith-corpus.js';

test('hadith catalog contains the eight core sources', () => {
  const books = listHadithBooks();
  assert.equal(books.length, 8);
  assert.ok(books.every((book) => book.sourceType === 'hadith'));
  assert.ok(findHadithBook('bukhari'));
  assert.ok(findHadithBook('muslim'));
});

test('catalog is metadata and does not imply full text rights', () => {
  assert.equal(getHadithCorpusCatalog().metadataPolicy.textStatus, 'not-implied-by-catalog');
});

test('hadith records require source and reference provenance', () => {
  const pending = validateHadithRecord({
    recordId: 'hadith:example',
    sourceId: 'bukhari',
    hadithReference: 'book 1, hadith 1',
    verificationState: 'pending_review',
    attribution: { authorAr: 'محمد بن إسماعيل البخاري' }
  });
  assert.equal(pending.valid, true);
  assert.equal(pending.trusted, false);
  const invalid = validateHadithRecord({ recordId: 'x', sourceId: 'unknown' });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.includes('unknown-source'));
});
