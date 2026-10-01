import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const registryPath = path.join(
  process.cwd(),
  'config/rechercher/global-multilingual-resource-discovery-2026.json'
);
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

test('global discovery keeps 106 as a minimum, not a hard cap', () => {
  assert.equal(registry.policy.minimum_verified_resource_lanes, 106);
  assert.equal(registry.policy['106_is_not_a_hard_cap'], true);
});

test('first-party evidence exceeds the minimum target', () => {
  const islamHouse = registry.evidence_sources.find((source) => source.id === 'islamhouse');
  assert.ok(islamHouse);
  assert.ok(islamHouse.claimed_language_count >= 106);
  assert.ok(islamHouse.enumerated_language_count_in_current_web_snapshot >= 106);
});

test('global evidence spans Quran, Quran metadata/sync, and hadith resources', () => {
  const ids = new Set(registry.evidence_sources.map((source) => source.id));
  assert.ok(ids.has('quranenc'));
  assert.ok(ids.has('quran_foundation'));
  assert.ok(ids.has('hadeethenc'));
});

test('machine translation remains explicitly separated from verified resources', () => {
  assert.equal(registry.policy.canonical_arabic_quran_separate, true);
  assert.equal(registry.policy.human_translation_separate_from_machine_translation, true);
  assert.equal(registry.policy.machine_translation_state, 'machine-translated');
  assert.equal(registry.policy.machine_translation_verification_state, 'unverified');
});

test('resource lanes include all 48 Islamic knowledge domains', () => {
  assert.equal(registry.resource_lanes.length, 48);
  assert.deepEqual(registry.resource_lanes, ["quran","quran_sciences","tafsir","tajweed_qiraat","quran_miracles","quran_tadabbur","quran_stories","hadith","hadith_sciences","hadith_terminology","hadith_explanation","sirah_nabawiyyah","shamail_nabawiyyah","aqidah","tawhid","fiqh","usul_al_fiqh","fiqh_schools_branches","fatwa","raqaiq_adab_akhlaq","islamic_history","biographies_tabaqat","comparative_fiqh","dawah_islamic_culture","general_islamic_encyclopedias","scientific_miracles","maqasid_kulliyat","legal_maxims","athar","adhkar_dua","prophets_stories","ghaib","sirah_maghazi","companions_followers","scholars_biographies_rijal_tabaqat","ethics_adab","worship_transactions","family_inheritance_judiciary","siyasah_finance_waqf","contemporary_dawah_education","scientific_encyclopedias_lectures","arabic_language","literature_poetry","manuscripts_editions_bibliography","research_institutions_terms_translation","places_dates","questions_answers","other_islamic_domains"] );
});


test('6384 matrix outputs use a dedicated storage repository', () => {
  const storage = JSON.parse(fs.readFileSync(
    path.join(process.cwd(), 'config/rechercher/global-multilingual-storage.json'), 'utf8'
  ));
  assert.equal(storage.storage_repository, 'lalibimohamed-maker/dinullah-matrix-6384-storage-01');
  assert.equal(storage.authentication.secret_name, 'RECHERCHER_MATRIX_STORAGE_TOKEN');
  assert.equal(storage.contract.matrix_content_isolated_from_main_repository, true);
  assert.equal(storage.contract.general_pdf_storage_is_separate_from_matrix_storage, true);
  assert.equal(storage.scope.source_code, 'excluded');
});
