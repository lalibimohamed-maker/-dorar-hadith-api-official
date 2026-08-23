import assert from 'node:assert/strict';
import test from 'node:test';
import { buildScholarAssessment, groupScholarAssessments } from '../src/hadith-scholar-assessments.js';

test('requires attribution fields', () => {
  assert.throws(() => buildScholarAssessment({ hadithId: 'h1', scholarId: 's1' }), /Invalid scholar assessment/);
});

test('preserves independent scholar assessments', () => {
  const result = groupScholarAssessments('h1', [
    { hadithId: 'h1', scholarId: 's1', scholarName: 'A', sourceId: 'r1', reference: '10', text: 'صحيح', classification: 'sahih' },
    { hadithId: 'h1', scholarId: 's2', scholarName: 'B', sourceId: 'r2', reference: '20', text: 'ضعيف', classification: 'daif' }
  ]);
  assert.equal(result.assessments.length, 2);
  assert.equal(result.disagreements, true);
  assert.equal(result.synthesizedVerdict, null);
});
