import assert from 'node:assert/strict';
import test from 'node:test';
import { groupHadithAssessments, normalizeHadithAssessment } from '../src/hadith-assessments.js';

test('requires attributed evidence for each scholar assessment', () => {
  const item = normalizeHadithAssessment({ hadithId:'h:1', scholarId:'s:1', scholarName:'ناقد', sourceId:'book:1', reference:'10', text:'حسن', classification:'hasan' });
  assert.equal(item.verificationState, 'pending_review');
  assert.equal(item.classification, 'hasan');
});

test('keeps disagreement visible and never synthesizes a verdict', () => {
  const result = groupHadithAssessments('h:2', [
    { hadithId:'h:2', scholarId:'s:1', sourceId:'r1', reference:'1', text:'صحيح', classification:'sahih' },
    { hadithId:'h:2', scholarId:'s:2', sourceId:'r2', reference:'2', text:'ضعيف', classification:'daif' }
  ]);
  assert.equal(result.count, 2);
  assert.equal(result.disagreement, true);
  assert.equal(result.synthesizedVerdict, null);
  assert.equal(result.byClassification.sahih, 1);
  assert.equal(result.byClassification.daif, 1);
});
