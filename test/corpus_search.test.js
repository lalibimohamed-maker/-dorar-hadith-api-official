const assert = require('assert');
const { searchCorpus, resolveConcept, makeBilingual } = require('../src/corpus_search');

const records = [
  { id: 'concept:arkan-al-iman', type: 'concept', title_ar: 'أركان الإيمان', verification_state: 'pending' },
  { id: 'concept:iman-billah', type: 'concept', title_ar: 'الإيمان بالله', verification_state: 'pending' }
];

const search = searchCorpus('أركان الإيمان', { language: 'ar' }, records);
assert.strictEqual(search.results.length, 1);
assert.strictEqual(search.results[0].trusted, false);

const card = resolveConcept('الإيمان بالله', 'concept:iman-billah', 'ar', records);
assert.strictEqual(card.duration_seconds, 5);
assert.strictEqual(card.window, 'medium');
assert.strictEqual(card.record.trusted, false);

const bilingual = makeBilingual('الإسلام', 'Islam', 'en');
assert.strictEqual(bilingual.original_arabic, 'الإسلام');
assert.strictEqual(bilingual.meaning_translation.language, 'en');
assert.strictEqual(bilingual.open_original_on_demand, true);

console.log('corpus API contract tests: OK');
