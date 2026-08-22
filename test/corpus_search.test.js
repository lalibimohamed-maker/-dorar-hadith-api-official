import assert from 'node:assert/strict';
import { searchCorpus, resolveConcept, makeBilingual } from '../src/corpus_search.js';

const records = [
  { id: 'concept:arkan-al-iman', type: 'concept', title_ar: 'أركان الإيمان', verification_state: 'pending' },
  { id: 'concept:iman-billah', type: 'concept', title_ar: 'الإيمان بالله', verification_state: 'pending' }
];

const search = searchCorpus('أركان الإيمان', { language: 'ar' }, records);
assert.equal(search.results.length, 1);
assert.equal(search.results[0].trusted, false);

const card = resolveConcept('الإيمان بالله', 'concept:iman-billah', 'ar', records);
assert.equal(card.duration_seconds, 5);
assert.equal(card.window, 'medium');
assert.equal(card.record.trusted, false);

const bilingual = makeBilingual('الإسلام', 'Islam', 'en');
assert.equal(bilingual.original_arabic, 'الإسلام');
assert.equal(bilingual.meaning_translation.language, 'en');
assert.equal(bilingual.open_original_on_demand, true);

console.log('corpus API contract tests: OK');
