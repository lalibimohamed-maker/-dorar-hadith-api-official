import assert from 'node:assert/strict';
import { search, concept } from '../src/corpus_api.js';

const searchResult = search('أركان الإيمان', { language: 'ar', bilingual: true });
assert.equal(searchResult.results.length, 1);
assert.equal(searchResult.results[0].id, 'concept:arkan-al-iman');
assert.equal(searchResult.results[0].trusted, false);
assert.equal(searchResult.bilingual, false);
assert.equal(searchResult.translationMode, 'disabled_for_search');
assert.equal(Object.hasOwn(searchResult, 'meaning_translation'), false);

const card = concept('الإيمان بالله', 'concept:iman-billah', 'ar');
assert.equal(card.duration_seconds, 5);
assert.equal(card.window, 'medium');
assert.equal(card.record.id, 'concept:iman-billah');
assert.equal(card.record.trusted, false);
assert.equal(card.translationMode, 'disabled_for_long_press');
assert.equal(Object.hasOwn(card, 'translations'), false);
assert.ok(card.knowledge);
assert.equal(Object.hasOwn(card.knowledge, 'translations'), false);

console.log('corpus API integration tests: OK');
