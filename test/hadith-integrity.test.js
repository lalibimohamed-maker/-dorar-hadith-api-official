import assert from 'node:assert/strict';import test from 'node:test';import {hadithIntegrityReport} from '../src/hadith-integrity.js';
test('integrity report counts incomplete records',()=>{const r=hadithIntegrityReport([{hadithId:'h1',sourceId:'bukhari',reference:'1',chain:['n1']},{hadithId:'h2'}]);assert.equal(r.total,2);assert.equal(r.ready,1);assert.equal(r.integrity,false);});
