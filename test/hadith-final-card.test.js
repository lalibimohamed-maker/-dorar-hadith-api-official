import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFinalHadithCard } from '../src/hadith-final-card.js';

test('final hadith card is traceable and non-synthesizing', () => {
  const card = buildFinalHadithCard({ hadithId:'h1', text:'نص', sourceId:'bukhari', reference:'1', chain:['n:a'] }, [], []);
  assert.equal(card.type, 'hadith-card');
  assert.equal(card.provenance.sourceId, 'bukhari');
  assert.equal(card.aiRequired, false);
  assert.equal(card.scholarAssessments.synthesizedVerdict, null);
});
