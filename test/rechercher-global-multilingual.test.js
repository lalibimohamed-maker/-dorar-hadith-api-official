import test from 'node:test';
import assert from 'node:assert/strict';
import registry from '../config/rechercher-global-multilingual-sources-v2.js';

const byId = (id) => registry.find((source) => source.id === id);

test('global multilingual registry contains verified full API sources', () => {
  for (const id of ['quranpedia-api', 'islamhouse-api', 'quranenc-api', 'hadeethenc-api']) {
    const item = byId(id);
    assert.ok(item, `missing ${id}`);
    assert.equal(item.api?.documented, true, `${id} must expose documented API metadata`);
    assert.ok(item.api?.baseUrl || item.api?.endpoints, `${id} must expose API surface metadata`);
  }
});

test('Quranpedia registry keeps the complete documented API surface', () => {
  const item = byId('quranpedia-api');
  assert.deepEqual(item.api.endpoints, [
    '/mushafs', '/mushafs/{mushaf_id}/{surah_id}/{ayah_number?}',
    '/surah/information/{surah}', '/ayah/{surah}/{ayah}/{service}',
    '/translations/{surah}/{ayah}/{language?}', '/translation-books/{language_code?}',
    '/translation/{book_id}/{surah_id}/{ayah_number?}', '/tafsir', '/books', '/fatwas',
    '/topics', '/reciters', '/search/{query}/{type}', '/changes?since={date}',
  ]);
});

test('HadeethEnc remains fully discoverable rather than a single-category connector', () => {
  const item = byId('hadeethenc-api');
  assert.ok(item.api.deepDiscovery);
  assert.ok(item.api.endpoints.some((endpoint) => endpoint === '/categories/list/?language={language}'));
  assert.ok(item.api.endpoints.some((endpoint) => endpoint === '/hadeeths/list/?language={language}&category_id={categoryId}&page={page}&per_page={perPage}'));
});

test('discovery never grants download rights', () => {
  for (const item of registry) assert.equal(item.discoveryOnly, true);
});

test('requested multilingual web sources are represented without invented APIs', () => {
  for (const id of ['islamqa-multilingual', 'alukah', 'ketabonline', 'islamplus', 'islamdag', 'muslim-library', 'islamicbulletin', 'whyislam', 'osoulstore', 'islamreligion', 'byenah', 'daura']) {
    const item = byId(id);
    assert.ok(item, `missing ${id}`);
    assert.equal(item.access.mode, 'web-discovery');
    assert.equal(item.api, null);
  }
});
