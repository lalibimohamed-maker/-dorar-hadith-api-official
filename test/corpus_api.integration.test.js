import assert from 'node:assert/strict';
import { search, concept, bilingual } from '../src/corpus_api.js';

const searchResult = search('أركان الإيمان', { language: 'ar' });
assert.equal(searchResult.results.length, 1);
assert.equal(searchResult.results[0].id, 'concept:arkan-al-iman');
assert.equal(searchResult.results[0].trusted, false);

const card = concept('الإيمان بالله', 'concept:iman-billah', 'ar');
assert.equal(card.duration_seconds, 5);
assert.equal(card.window, 'medium');
assert.equal(card.record.id, 'concept:iman-billah');
assert.equal(card.record.trusted, false);
assert.ok(card.knowledge);

const bilingualResult = bilingual('الإيمان بالله', 'Faith in Allah', 'en');
assert.equal(bilingualResult.original_arabic, 'الإيمان بالله');
assert.equal(bilingualResult.meaning_translation.language, 'en');

console.log('corpus API integration tests: OK');
