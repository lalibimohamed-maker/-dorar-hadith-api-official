import assert from 'node:assert/strict';import test from 'node:test';import { searchHadith } from '../src/hadith-search.js';
test('searches hadith text and preserves source',()=>{const r=searchHadith([{hadithId:'h1',text:'طلب العلم',sourceId:'bukhari',reference:'1'}],'العلم');assert.equal(r[0].hadithId,'h1');assert.equal(r[0].sourceId,'bukhari');});
