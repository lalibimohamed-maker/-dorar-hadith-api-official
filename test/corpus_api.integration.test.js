const assert = require('assert');
const api = require('../src/corpus_api');

const search = api.search('أركان الإيمان', { language: 'ar' });
assert.strictEqual(search.results.length, 1);
assert.strictEqual(search.results[0].id, 'concept:arkan-al-iman');
assert.strictEqual(search.results[0].trusted, false);

const card = api.concept('الإيمان بالله', 'concept:iman-billah', 'ar');
assert.strictEqual(card.duration_seconds, 5);
assert.strictEqual(card.window, 'medium');
assert.strictEqual(card.record.id, 'concept:iman-billah');
assert.strictEqual(card.record.trusted, false);
assert.ok(card.knowledge);

const bilingual = api.bilingual('الإيمان بالله', 'Faith in Allah', 'en');
assert.strictEqual(bilingual.original_arabic, 'الإيمان بالله');
assert.strictEqual(bilingual.meaning_translation.language, 'en');

console.log('corpus API integration tests: OK');
