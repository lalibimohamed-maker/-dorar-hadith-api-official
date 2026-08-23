import assert from 'node:assert/strict';
import test from 'node:test';
import { hadithBook, hadithCatalog, hadithNarratorGrade, hadithNarratorJudgmentComparison, hadithNarratorProfile, hadithRijalBooks, hadithRecordValidation } from '../src/corpus_api.js';

test('hadith API exposes source catalog', () => {
  assert.equal(hadithCatalog().length, 8);
  assert.equal(hadithBook('bukhari').titleAr, 'صحيح البخاري');
});

test('hadith API validates provenance without inventing a grade', () => {
  const result = hadithRecordValidation({ recordId: 'h:1', sourceId: 'muslim', hadithReference: '1', verificationState: 'pending_review', attribution: {} });
  assert.equal(result.valid, true);
  assert.equal(result.trusted, false);
});

test('narrator research preserves attributed judgments and disagreements', () => {
  const profile = hadithNarratorProfile({ name: 'راوٍ تجريبي', judgments: [
    { critic: 'ناقد أ', source: 'كتاب أ', wording: 'ثقة', grade: 'thiqah' },
    { critic: 'ناقد ب', source: 'كتاب ب', wording: 'ضعيف', grade: 'daif', disputed: true }
  ] });
  assert.equal(profile.judgments.length, 2);
  assert.equal(profile.disputed.length, 1);
  assert.equal(hadithNarratorGrade('thiqah').nameAr, 'ثقة');
  const compared = hadithNarratorJudgmentComparison(profile.judgments);
  assert.equal(compared.accepted.length, 1);
  assert.equal(compared.disputed.length, 1);
});

test('rijal catalog is available for research routing', () => {
  assert.ok(hadithRijalBooks().length >= 10);
});
