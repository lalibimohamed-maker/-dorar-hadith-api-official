import assert from 'node:assert/strict';
import test from 'node:test';
import { findHadithByReference, indexHadithReferences } from '../src/hadith-reference-index.js';
test('indexes hadith by source and reference',()=>{const i=indexHadithReferences([{hadithId:'h1',sourceId:'bukhari',reference:'1'}]);assert.deepEqual(findHadithByReference(i,'bukhari','1'),['h1']);});
