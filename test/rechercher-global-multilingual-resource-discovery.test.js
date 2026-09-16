const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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

test('resource lanes include core Islamic knowledge domains', () => {
  for (const lane of ['quran', 'tafsir', 'hadith', 'sunnah', 'sirah', 'aqidah', 'fiqh', 'fatwa', 'books', 'provenance', 'rights', 'verification']) {
    assert.ok(registry.resource_lanes.includes(lane), `missing lane: ${lane}`);
  }
});
