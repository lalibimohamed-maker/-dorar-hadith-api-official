import test from 'node:test';
import assert from 'node:assert/strict';
import { NATIVE_SOURCES } from '../config/rechercher-native-sources.js';
import { VERIFIED_MULTILINGUAL_CONNECTORS } from '../config/rechercher-verified-multilingual-connectors.js';
import { RECHERCHER_COUNTRY_SOURCE_REGISTRIES, RECHERCHER_COUNTRY_CODES } from '../config/rechercher-country-source-registries.js';
import { allCountrySources, countrySources } from '../src/rechercher/country-source-registry.js';
import { createConnectorManifest } from '../src/rechercher/native-source-connectors.js';
import { federatedSearch, selectAcquisitionCandidates } from '../src/rechercher/native-federation-engine.js';

test('native source registry contains the core international and Islamic sources', () => {
  const ids = new Set(NATIVE_SOURCES.map((s) => s.id));
  for (const id of ['internet-archive', 'open-library', 'openiti', 'wikimedia-commons', 'library-of-congress', 'crossref', 'google-books', 'gallica-bnf', 'british-library-eap', 'princeton-pul', 'bodleian', 'cambridge-digital', 'vatican-library', 'qatar-digital-library', 'nyu-aco', 'al-furqan', 'waqfeya', 'shamela']) assert.ok(ids.has(id), `missing ${id}`);
});

test('verified multilingual registry contains extracted official API contracts', () => {
  const byId = new Map(VERIFIED_MULTILINGUAL_CONNECTORS.map((source) => [source.id, source]));
  assert.equal(byId.get('quranenc').connector.kind, 'rest-json-catalog');
  assert.match(byId.get('quranenc').connector.searchUrl, /^https:\/\/quranenc\.com\/api\//);
  assert.equal(byId.get('hadeethenc-api').connector.kind, 'rest-json-catalog');
  assert.equal(byId.get('hadeethenc-api').connector.searchUrl, 'https://hadeethenc.com/api/v1/hadeeths/list/');
  assert.equal(byId.get('hadeethenc-api').connector.queryMap().language, 'ar');
  assert.equal(byId.get('islamenc-api').connector.kind, 'rest-json-catalog');
  assert.equal(byId.get('islamenc-api').connector.searchUrl, 'https://s.islamenc.com/api/v1/services');
  assert.equal(byId.get('islamhouse').connector.kind, 'rest-json-keyed-path');
});

test('country registries cover the Arab source map and Saudi has a deep registry', () => {
  assert.equal(RECHERCHER_COUNTRY_CODES.length, 22);
  assert.ok(RECHERCHER_COUNTRY_CODES.includes('SA'));
  assert.ok(RECHERCHER_COUNTRY_SOURCE_REGISTRIES.SA.sources.length >= 20);
  assert.ok(RECHERCHER_COUNTRY_SOURCE_REGISTRIES.AE.sources.length >= 3);
  assert.ok(RECHERCHER_COUNTRY_SOURCE_REGISTRIES.QA.sources.length >= 3);
});

test('country registry adapters preserve country and rights metadata', () => {
  const sa = countrySources('SA');
  const all = allCountrySources();
  assert.equal(sa.length, RECHERCHER_COUNTRY_SOURCE_REGISTRIES.SA.sources.length);
  assert.ok(all.length >= sa.length);
  assert.ok(sa.every((source) => source.country === 'SA'));
  assert.ok(sa.every((source) => source.rightsPolicy));
  assert.ok(sa.every((source) => source.connector.kind === 'web-discovery'));
});

test('manifest exposes connector kind, acquisition and rights policy', () => {
  const manifest = createConnectorManifest(NATIVE_SOURCES);
  assert.equal(manifest.length, NATIVE_SOURCES.length);
  assert.ok(manifest.some((x) => x.id === 'internet-archive' && x.kind === 'rest-json'));
  assert.ok(manifest.some((x) => x.id === 'gallica-bnf' && x.kind === 'web-discovery'));
});

test('acquisition candidate selection blocks restricted records', () => {
  const records = [
    { sourceId: 'a', identifier: '1', pdfUrl: 'https://example.org/a.pdf', rightsStatus: 'public' },
    { sourceId: 'b', identifier: '2', pdfUrl: 'https://example.org/a.pdf', rightsStatus: 'public' },
    { sourceId: 'c', identifier: '3', pdfUrl: 'https://example.org/c.pdf', rightsStatus: 'restricted' },
  ];
  assert.deepEqual(selectAcquisitionCandidates(records).map((x) => x.pdfUrl), ['https://example.org/a.pdf']);
});

test('federation can run against a supplied local source set without changing corpus data', async () => {
  const source = { id: 'fixture', name: 'Fixture', enabled: true, acquisition: 'metadata-only', rightsPolicy: 'unknown-blocked', connector: { kind: 'web-discovery', searchUrl: 'https://example.org', queryMap: () => ({}), mapResults: () => [] } };
  const result = await federatedSearch('كتاب', { sources: [source] });
  assert.equal(result.sourcesChecked, 1);
  assert.equal(result.recordsFound, 0);
  assert.equal(result.telemetry[0].status, 'success');
});
