import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHadithCard } from '../src/hadith-card.js';
import { buildNarratorRelation } from '../src/rijal-chain.js';

test('builds a traceable hadith card without synthesizing a verdict', () => {
  const relations = [buildNarratorRelation({ fromNarratorId: 'n:a', toNarratorId: 'n:b', relationType: 'teacher', sourceId: 'r1', reference: '10' })];
  const card = buildHadithCard({ hadithId: 'h:1', sourceId: 'bukhari', reference: '1', chain: ['n:a', 'n:b'] }, relations, [
    { hadithId: 'h:1', scholarId: 's1', sourceId: 'r1', reference: '10', text: 'حسن', classification: 'hadith_grade' }
  ]);
  assert.equal(card.chainEvidence.valid, true);
  assert.equal(card.source.sourceId, 'bukhari');
  assert.equal(card.scholarAssessments.count, 1);
  assert.equal(card.scholarAssessments.synthesizedVerdict, null);
  assert.equal(card.aiRequired, false);
});
