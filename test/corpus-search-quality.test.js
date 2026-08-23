import assert from 'node:assert/strict';
import test from 'node:test';
import { searchCorpus } from '../src/corpus_search.js';

const records = [
  { id:'book-prayer', title_ar:'الصلاة', domain:'fiqh', verification_state:'verified' },
  { id:'book-fajr', title_ar:'مواقيت الصلاة والفجر', domain:'fiqh', verification_state:'pending_verification' },
  { id:'scholar-uthaymeen', title_ar:'فتاوى الشيخ محمد بن صالح العثيمين', authorName:'محمد بن صالح العثيمين', domain:'fatwa', verification_state:'scholar-reviewed' }
];

test('normalizes Arabic search and ranks exact titles first', () => {
  const result = searchCorpus('إلصلاة', { language:'ar' }, records);
  assert.equal(result.results[0].id, 'book-prayer');
  assert.equal(result.results[0].trusted, true);
});

test('searches author metadata and preserves trust state', () => {
  const result = searchCorpus('العثيمين', { language:'ar' }, records);
  assert.equal(result.results[0].id, 'scholar-uthaymeen');
  assert.equal(result.results[0].trusted, true);
});

test('does not promote pending records to trusted', () => {
  const result = searchCorpus('الفجر', { language:'ar' }, records);
  const pending = result.results.find(item => item.id === 'book-fajr');
  assert.equal(pending.trusted, false);
});

test('supports bounded result limits', () => {
  const result = searchCorpus('الصلاة', { limit:1 }, records);
  assert.equal(result.results.length, 1);
});
