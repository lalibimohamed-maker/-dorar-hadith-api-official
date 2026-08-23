import assert from 'node:assert/strict';
import test from 'node:test';
import { attachChainEvidence, compareHadithScholarAssessments, validateHadithChainEvidence } from '../src/hadith-chain-evidence.js';
import { buildNarratorRelation } from '../src/rijal-chain.js';

const relations = [
  buildNarratorRelation({ fromNarratorId: 'n:a', toNarratorId: 'n:b', relationType: 'teacher', sourceId: 'rijal-1', reference: '10' }),
  buildNarratorRelation({ fromNarratorId: 'n:b', toNarratorId: 'n:c', relationType: 'teacher', sourceId: 'rijal-2', reference: '20' })
];

test('links a hadith to source-backed chain evidence', () => {
  const result = validateHadithChainEvidence({ hadithId: 'h:1', sourceId: 'bukhari', reference: '1', chain: ['n:a', 'n:b', 'n:c'] }, relations);
  assert.equal(result.valid, true);
  assert.equal(result.chainEvidenceValid, true);
});

test('does not call a missing chain link a hadith verdict', () => {
  const result = validateHadithChainEvidence({ hadithId: 'h:2', sourceId: 'bukhari', reference: '2', chain: ['n:a', 'n:c'] }, relations);
  assert.equal(result.valid, false);
  assert.equal(result.chainErrors[0].reason, 'no-linked-evidence');
});

test('keeps scholar assessments separate', () => {
  const result = compareHadithScholarAssessments('h:3', [
    { hadithId: 'h:3', scholarId: 's1', scholarName: 'Scholar A', sourceId: 'r1', reference: '10', text: 'حسن', classification: 'hadith_grade' },
    { hadithId: 'h:3', scholarId: 's2', scholarName: 'Scholar B', sourceId: 'r2', reference: '20', text: 'ضعيف', classification: 'hadith_grade' }
  ]);
  assert.equal(result.count, 2);
  assert.equal(result.synthesizedVerdict, null);
});

test('attachment is additive and traceable', () => {
  const result = attachChainEvidence({ hadithId: 'h:4', sourceId: 'muslim', reference: '4', chain: ['n:a', 'n:b'] }, relations);
  assert.ok(result.chainEvidence);
  assert.equal(result.chainEvidence.hadithId, 'h:4');
});
