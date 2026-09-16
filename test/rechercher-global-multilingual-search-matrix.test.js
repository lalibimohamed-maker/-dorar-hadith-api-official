const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const matrix = JSON.parse(fs.readFileSync(path.join(root, 'config/rechercher/global-multilingual-search-matrix-2026.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(root, matrix.language_registry), 'utf8'));

test('global matrix is exactly 133 languages by 24 domains', () => {
  assert.equal(registry.enumerated_islamhouse_languages.length, matrix.language_count);
  assert.equal(matrix.domains.length, matrix.domain_count);
  assert.equal(matrix.language_count * matrix.domain_count, 3192);
  assert.equal(matrix.expected_search_cells, 3192);
  assert.ok(registry.enumerated_islamhouse_languages.includes('Bengali'));
});

test('every cell uses the full evidence pipeline', () => {
  assert.deepEqual(matrix.cell_pipeline, [
    'primary_or_institutional_source',
    'official_api',
    'digital_corpus',
    'structured_web',
    'scholarly_dataset',
    'translation_metadata',
    'provenance',
    'rights',
    'verification'
  ]);
});

test('translation confidence states and Quran boundary are enforced', () => {
  for (const state of ['source-verified', 'institutionally-reviewed', 'scholarly', 'provenance-complete', 'candidate', 'unverified', 'translation-needed', 'machine-translated']) {
    assert.ok(matrix.translation_states.includes(state), `missing state: ${state}`);
  }
  assert.equal(matrix.quran_boundary.overwrite_canonical_arabic, false);
  assert.equal(matrix.quran_boundary.canonical_arabic, 'isolated_corpus_layer');
});

test('matrix remains open-ended beyond 106', () => {
  assert.equal(matrix.expansion_policy.minimum_language_target, 106);
  assert.equal(matrix.expansion_policy.target_is_not_a_cap, true);
  assert.equal(matrix.expansion_policy.do_not_synthesize_languages_without_evidence, true);
});
