import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GLOBAL_ISLAMIC_SOURCE_COUNT,
  buildProviderPlan,
  getSourceById,
  getDiscoverySources
} from '../src/rechercher-global-source-registry.js';

test('global registry contains the previously identified Islamic source network', () => {
  assert.ok(GLOBAL_ISLAMIC_SOURCE_COUNT >= 45);
  for (const id of [
    'waqfeya',
    'foulabook',
    'quranpedia',
    'ketabonline',
    'archive-org',
    'openlibrary',
    'google-books',
    'europeana',
    'arabic-collections-online',
    'al-furqan',
    'ircica',
    'qalamos',
    'fihrist',
    'aga-khan-library',
    'hmml',
    'rsl-russia',
    'tatarstan-nel',
    'diyanet-mss',
    'kemenag',
    'bosniak-institute',
    'bnf-gallica',
    'manuscripta-csic'
  ]) assert.ok(getSourceById(id), `missing source ${id}`);
});

test('provider plan prefers open/conditional discovery without granting redistribution rights', () => {
  const plan = buildProviderPlan();
  assert.ok(plan.length >= 30);
  assert.equal(plan[0].priority, 0);
  assert.ok(plan.every(source => source.rights));
});

test('discovery sources include the existing manuscript/book network', () => {
  const ids = new Set(getDiscoverySources().map(source => source.id));
  assert.ok(ids.has('al-furqan'));
  assert.ok(ids.has('harvard-islamic-heritage'));
  assert.ok(ids.has('digital-scriptorium'));
  assert.ok(ids.has('princeton-islamic-mss'));
  assert.ok(ids.has('yale-ameel'));
  assert.ok(ids.has('british-library'));
  assert.ok(ids.has('qatar-digital-library'));
});
