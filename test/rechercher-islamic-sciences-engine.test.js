import test from 'node:test';
import assert from 'node:assert/strict';
import { createIslamicSciencesEngine, registerSource, registerItem, registerFiqhPosition, recordDisagreement, getSourceStatus } from '../src/rechercher-islamic-sciences-engine.js';

test('Islamic sciences engine keeps source identity and rights', () => {
  const e = createIslamicSciencesEngine();
  registerSource(e, { sourceId:'q1', science:'QURAN', sourceHash:'sha-q1', rightsStatus:'ALLOWED' });
  registerItem(e, { itemId:'v1', science:'QURAN', title:'verse', sourceIds:['q1'] });
  assert.equal(e.items.get('v1').sourceIds[0], 'q1');
  assert.equal(getSourceStatus(e,'q1').usableForPublication, true);
});

test('fiqh positions preserve madhhab disagreement', () => {
  const e = createIslamicSciencesEngine();
  registerSource(e, { sourceId:'f1', science:'FIQH', sourceHash:'sha-f1', rightsStatus:'ALLOWED' });
  registerFiqhPosition(e, { positionId:'p1', issueId:'i1', madhhab:'HANAFI', text:'position A', sourceIds:['f1'] });
  registerFiqhPosition(e, { positionId:'p2', issueId:'i1', madhhab:'MALIKI', text:'position B', sourceIds:['f1'] });
  recordDisagreement(e, { disagreementId:'d1', topicId:'i1', positionIds:['p1','p2'] });
  assert.deepEqual(e.disagreements.get('d1').positionIds, ['p1','p2']);
});

test('unknown or restricted rights are not publishable', () => {
  const e = createIslamicSciencesEngine();
  registerSource(e, { sourceId:'h1', science:'HADITH', sourceHash:'sha-h1', rightsStatus:'UNKNOWN' });
  assert.equal(getSourceStatus(e,'h1').usableForPublication, false);
});
