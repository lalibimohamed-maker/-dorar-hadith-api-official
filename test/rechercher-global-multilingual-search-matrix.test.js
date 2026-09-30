import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const matrix = JSON.parse(fs.readFileSync(path.join(root, 'config/rechercher/global-multilingual-search-matrix-2026.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(root, matrix.language_registry), 'utf8'));


test('global matrix is exactly 133 unique languages by 48 Islamic knowledge domains', () => {
  const languages = registry.enumerated_islamhouse_languages;
  assert.equal(languages.length, matrix.language_count);
  assert.equal(new Set(languages).size, matrix.language_count);
  assert.equal(matrix.domains.length, matrix.domain_count);
  assert.equal(new Set(matrix.domains).size, matrix.domain_count);
  assert.equal(matrix.language_count * matrix.domain_count, 6384);
  assert.deepEqual(matrix.knowledge_domains, [
    'quran',
    'quran_sciences',
    'tafsir',
    'tajweed_qiraat'
    'quran_miracles',
    'quran_tadabbur',
    'quran_stories',
    'hadith'
    'hadith_sciences',
    'hadith_terminology',
    'hadith_explanation',
    'sirah_nabawiyyah'
    'shamail_nabawiyyah',
    'aqidah',
    'tawhid',
    'fiqh'
    'usul_al_fiqh',
    'fiqh_schools_branches',
    'fatwa',
    'raqaiq_adab_akhlaq'
    'islamic_history',
    'biographies_tabaqat',
    'comparative_fiqh',
    'dawah_islamic_culture'
    'general_islamic_encyclopedias',
    'scientific_miracles',
    'maqasid_kulliyat',
    'legal_maxims'
    'athar',
    'adhkar_dua',
    'prophets_stories',
    'ghaib'
    'sirah_maghazi',
    'companions_followers',
    'scholars_biographies_rijal_tabaqat',
    'ethics_adab'
    'worship_transactions',
    'family_inheritance_judiciary',
    'siyasah_finance_waqf',
    'contemporary_dawah_education'
    'scientific_encyclopedias_lectures',
    'arabic_language',
    'literature_poetry',
    'manuscripts_editions_bibliography'
    'research_institutions_terms_translation',
    'places_dates',
    'questions_answers',
    'other_islamic_domains'
  ]);  assert.equal(matrix.knowledge_domains.length, 48);
  assert.equal(matrix.support_lanes.length, 0);
  assert.equal(matrix.expected_search_cells, 6384);
  assert.ok(languages.includes('Bengali'));
  assert.ok(languages.includes('Malagasy'));
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
