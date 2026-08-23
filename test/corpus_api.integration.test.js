import assert from 'node:assert/strict';
import { search, concept, encyclopediaSearch, encyclopediaSource, encyclopediaDomain } from '../src/corpus_api.js';

const searchResult = search('أركان الإيمان', { language: 'ar', bilingual: true });
assert.equal(searchResult.results.length, 1);
assert.equal(searchResult.results[0].id, 'concept:arkan-al-iman');
assert.equal(searchResult.results[0].trusted, false);
assert.equal(searchResult.bilingual, false);
assert.equal(searchResult.translationMode, 'disabled_for_search');
assert.equal(Object.hasOwn(searchResult, 'meaning_translation'), false);
assert.ok(searchResult.encyclopedia);
assert.equal(searchResult.encyclopedia.aiRequired, false);

const card = concept('الإيمان بالله', 'concept:iman-billah', 'ar');
assert.equal(card.duration_seconds, 5);
assert.equal(card.window, 'medium');
assert.equal(card.record.id, 'concept:iman-billah');
assert.equal(card.record.trusted, false);
assert.equal(card.translationMode, 'disabled_for_long_press');
assert.equal(Object.hasOwn(card, 'translations'), false);
assert.ok(card.knowledge);
assert.equal(Object.hasOwn(card.knowledge, 'translations'), false);

const encyclopediaResult = encyclopediaSearch('صحيح البخاري');
assert.equal(encyclopediaResult.aiRequired, false);
assert.ok(encyclopediaResult.count > 0);

const bukhari = encyclopediaSource('bukhari');
assert.deepEqual(bukhari.domains, ['hadith']);
assert.ok(bukhari.relatedSources.includes('muslim'));

const hadithDomain = encyclopediaDomain('hadith');
assert.ok(hadithDomain.sources.includes('bukhari'));

console.log('corpus API integration tests: OK');
