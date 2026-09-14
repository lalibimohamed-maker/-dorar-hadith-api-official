import { strict as assert } from 'node:assert';
import { createQuranTajweedMemorizationEngine, registerVerse, addTajweedFinding, recordMemorization } from '../src/rechercher-quran-tajweed-memorization-engine.js';

describe('Rechercher Quran tajweed memorization', () => {
  it('preserves canonical Arabic registration by source hash', () => {
    const e = createQuranTajweedMemorizationEngine();
    registerVerse(e,{verseId:'1:1',surah:1,ayah:1,arabic:'بِسْمِ اللَّهِ',sourceId:'quran-canonical',sourceHash:'h'});
    assert.equal(e.verses.get('1:1').sourceHash,'h');
  });
  it('keeps automated tajweed findings provisional until human review', () => {
    const e = createQuranTajweedMemorizationEngine();
    registerVerse(e,{verseId:'1:1',surah:1,ayah:1,arabic:'نَصّ',sourceId:'q',sourceHash:'h'});
    addTajweedFinding(e,{findingId:'f',verseId:'1:1',rule:'idgham',locator:'token:1'});
    assert.equal(e.tajweed.get('f').state,'CANDIDATE');
    assert.throws(() => addTajweedFinding(e,{findingId:'f2',verseId:'1:1',rule:'idgham',locator:'token:1',state:'REVIEWED',reviewerRole:'STUDENT'}));
  });
  it('tracks memorization independently from canonical source text', () => {
    const e = createQuranTajweedMemorizationEngine();
    registerVerse(e,{verseId:'1:1',surah:1,ayah:1,arabic:'نَصّ',sourceId:'q',sourceHash:'h'});
    recordMemorization(e,{learnerId:'u',verseId:'1:1',correct:true,confidence:0.9});
    assert.equal(e.verses.get('1:1').arabic,'نَصّ');
    assert.equal(e.memorization.get('u:1:1').state,'RETAINED');
  });
});
