import test from 'node:test';
import assert from 'node:assert/strict';
import { multilingualUnifiedKnowledgeSearch } from '../src/multilingual-unified-knowledge-search.js';

test('keeps the original query while expanding multilingual aliases', () => {
  const records = [
    { id: 'musa', title_ar: 'موسى', text: 'قصة موسى عليه السلام', verification_state: 'verified' },
    { id: 'ibrahim', title_ar: 'إبراهيم', text: 'قصة إبراهيم عليه السلام', verification_state: 'verified' },
  ];
  const result = multilingualUnifiedKnowledgeSearch({
    query: 'เรื่องราวของมูซา',
    requestedLanguage: 'th',
    aliases: ['موسى', 'Musa', 'Moses'],
    options: { limit: 10 },
    records,
  });

  assert.equal(result.query, 'เรื่องราวของมูซา');
  assert.equal(result.language, 'th');
  assert.equal(result.direction, 'ltr');
  assert.deepEqual(result.probes, ['เรื่องราวของมูซา', 'موسى', 'Musa', 'Moses']);
  assert.equal(result.results[0].id, 'musa');
  assert.equal(result.preserve_original_text, true);
});

test('does not duplicate records found by multiple aliases', () => {
  const records = [
    { id: 'musa', title_ar: 'موسى', text: 'موسى نبي الله' },
  ];
  const result = multilingualUnifiedKnowledgeSearch({
    query: 'قصة موسى',
    aliases: ['موسى', 'Musa'],
    records,
  });

  assert.equal(result.results.filter((item) => item.id === 'musa').length, 1);
});
