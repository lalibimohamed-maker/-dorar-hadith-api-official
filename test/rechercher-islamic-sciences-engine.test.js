import test from 'node:test';
import assert from 'node:assert/strict';
import { createIslamicSciencesEngine, registerSource, registerItem, registerFiqhPosition, recordDisagreement, getSourceStatus, registerNarrator, addTafsirComparison, registerSirahEvent, registerTranslation } from '../src/rechercher-islamic-sciences-engine.js';

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

test('v5 specialized records preserve narrator, tafsir, sirah and translation provenance', () => {
  const e = createIslamicSciencesEngine();
  registerSource(e, { sourceId:'s1', science:'TAFSIR', sourceHash:'sha-s1', rightsStatus:'ALLOWED' });
  registerNarrator(e, { narratorId:'n1', name:'Narrator', sourceIds:['s1'] });
  addTafsirComparison(e, { comparisonId:'t1', verseId:'v1', tafsirIds:['tafsir-a','tafsir-b'], sourceIds:['s1'] });
  registerSirahEvent(e, { eventId:'e1', title:'Event', dateLabel:'1 AH', sourceIds:['s1'] });
  registerTranslation(e, { translationId:'tr1', sourceId:'s1', language:'fr', textHash:'translation-sha', provenance:{ edition:'1' } });
  assert.equal(e.narrators.get('n1').sourceIds[0], 's1');
  assert.equal(e.tafsirComparisons.get('t1').tafsirIds.length, 2);
  assert.equal(e.sirahEvents.get('e1').sourceIds[0], 's1');
  assert.equal(e.translations.get('tr1').provenance.edition, '1');
});
