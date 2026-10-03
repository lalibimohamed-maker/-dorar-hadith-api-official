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

test('verified multilingual registry contains dynamic HadeethEnc discovery contract', () => {
  const byId = new Map(VERIFIED_MULTILINGUAL_CONNECTORS.map((source) => [source.id, source]));
  assert.equal(byId.get('quranenc').connector.kind, 'rest-json-catalog');
  assert.match(byId.get('quranenc').connector.searchUrl, /^https:\/\/quranenc\.com\/api\//);
  const hadeeth = byId.get('hadeethenc-api');
  assert.equal(hadeeth.connector.kind, 'rest-json-catalog');
  assert.equal(hadeeth.connector.searchUrl, 'https://hadeethenc.com/api/v1/hadeeths/list/');
  assert.equal(hadeeth.connector.queryMap({ language: 'fr', categoryId: 42, page: 3, perPage: 77 }).language, 'fr');
  assert.equal(hadeeth.connector.queryMap({ language: 'fr', categoryId: 42, page: 3, perPage: 77 }).category_id, 42);
  assert.equal(hadeeth.connector.queryMap({ language: 'fr', categoryId: 42, page: 3, perPage: 77 }).page, 3);
  assert.equal(hadeeth.connector.queryMap({ language: 'fr', categoryId: 42, page: 3, perPage: 77 }).per_page, 77);
  assert.equal(hadeeth.connector.discovery.strategy, 'languages-categories-pagination');
  assert.equal(hadeeth.connector.discovery.languagesUrl, 'https://hadeethenc.com/api/v1/languages');
  assert.equal(hadeeth.connector.discovery.categoriesUrl, 'https://hadeethenc.com/api/v1/categories/list/');
  assert.equal(hadeeth.connector.discovery.rootsUrl, 'https://hadeethenc.com/api/v1/categories/roots/');
  assert.equal(hadeeth.connector.discovery.hadithUrl, 'https://hadeethenc.com/api/v1/hadeeths/list/');
  assert.equal(hadeeth.connector.discovery.detailUrl, 'https://hadeethenc.com/api/v1/hadeeths/one/');
  assert.equal(hadeeth.connector.discovery.pageSize, 100);
  assert.equal(hadeeth.connector.discovery.maxRetries, 4);
  assert.ok(!hadeeth.connector.queryMap({ language: 'ar' }).hasOwnProperty('category_id') || hadeeth.connector.queryMap({ language: 'ar' }).category_id === undefined);
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

test('manifest exposes connector kind, acquisition, rights policy and discovery strategy', () => {
  const manifest = createConnectorManifest(NATIVE_SOURCES);
  assert.equal(manifest.length, NATIVE_SOURCES.length);
  assert.ok(manifest.some((x) => x.id === 'internet-archive' && x.kind === 'rest-json'));
  assert.ok(manifest.some((x) => x.id === 'gallica-bnf' && x.kind === 'web-discovery'));
  const verifiedManifest = createConnectorManifest(VERIFIED_MULTILINGUAL_CONNECTORS);
  const hadeethManifest = verifiedManifest.find((x) => x.id === 'hadeethenc-api');
  assert.equal(hadeethManifest.discoveryStrategy, 'languages-categories-pagination');
  assert.ok(hadeethManifest.endpoints.some((endpoint) => endpoint === 'https://hadeethenc.com/api/v1/languages'));
  assert.ok(hadeethManifest.endpoints.some((endpoint) => endpoint === 'https://hadeethenc.com/api/v1/categories/list/'));
});

test('acquisition candidate selection requires an explicitly downloadable rights status', () => {
  const records = [
    { sourceId: 'a', identifier: '1', pdfUrl: 'https://example.org/a.pdf', rightsStatus: 'public' },
    { sourceId: 'b', identifier: '2', pdfUrl: 'https://example.org/a.pdf', rightsStatus: 'public' },
    { sourceId: 'c', identifier: '3', pdfUrl: 'https://example.org/c.pdf', rightsStatus: 'restricted' },
    { sourceId: 'd', identifier: '4', pdfUrl: 'https://example.org/d.pdf', rightsStatus: 'source-declared' },
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
