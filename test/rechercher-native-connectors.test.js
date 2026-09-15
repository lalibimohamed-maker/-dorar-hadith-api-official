import test from 'node:test';
import assert from 'node:assert/strict';
import { NATIVE_SOURCES } from '../config/rechercher-native-sources.js';
import { createConnectorManifest } from '../src/rechercher/native-source-connectors.js';
import { federatedSearch, selectAcquisitionCandidates } from '../src/rechercher/native-federation-engine.js';

test('native source registry contains the core international and Islamic sources', () => {
  const ids = new Set(NATIVE_SOURCES.map((s) => s.id));
  for (const id of ['internet-archive', 'open-library', 'openiti', 'wikimedia-commons', 'library-of-congress', 'crossref', 'google-books', 'gallica-bnf', 'british-library-eap', 'princeton-pul', 'bodleian', 'cambridge-digital', 'vatican-library', 'qatar-digital-library', 'nyu-aco', 'al-furqan', 'waqfeya', 'shamela']) {
    assert.ok(ids.has(id), `missing ${id}`);
  }
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
  const source = {
    id: 'fixture', name: 'Fixture', enabled: true, acquisition: 'metadata-only', rightsPolicy: 'unknown-blocked',
    connector: {
      kind: 'web-discovery', searchUrl: 'https://example.org', queryMap: () => ({}), mapResults: () => [],
    },
  };
  const result = await federatedSearch('كتاب', { sources: [source] });
  assert.equal(result.sourcesChecked, 1);
  assert.equal(result.recordsFound, 0);
  assert.equal(result.telemetry[0].status, 'success');
});
