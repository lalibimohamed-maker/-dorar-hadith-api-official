import assert from 'node:assert/strict';
import { search, concept } from '../src/corpus_api.js';

const ruh = concept('الروح', '', 'en');
assert.equal(ruh.language, 'en');
assert.equal(ruh.ghaibResearch.concept.ghaybDomain, 'ruh');
assert.ok(ruh.ghaibResearch.evidence.some(x => x.source_id === 'quran' && x.locator === '17:85'));
assert.ok(ruh.ghaibResearch.rules.doNotPresentUnknownAsFact);

const istawa = concept('الاستواء', '', 'en');
assert.equal(istawa.ghaibResearch.concept.ghaybDomain, 'istawa');
assert.ok(istawa.ghaibResearch.evidence.some(x => x.locator === '20:5'));
assert.equal(istawa.record.trusted, false);

const paradise = search('طبقات الجنة', { language: 'en' });
assert.equal(paradise.ghaibResearch.concept.ghaybDomain, 'paradise');
assert.ok(paradise.ghaibResearch.evidence.some(x => x.locator === '23:10-11'));

console.log('Ghaib evidence API tests: OK');
