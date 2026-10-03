import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldwideConnectorSuite, candidate, searchOpenAlex, searchCrossref, searchDataCite, searchInternetArchive } from '../src/rechercher-worldwide-connector-suite.js';

function fakeFetch(payload) {
  return async () => ({ ok: true, status: 200, async json() { return payload; }, async text() { return JSON.stringify(payload); } });
}

test('worldwide suite exposes connectors in the required order', () => {
  const suite = createWorldwideConnectorSuite({ fetchImpl: fakeFetch({}) });
  assert.deepEqual(suite.order, ['IIIF','OPENITI_KITAB','LIBRARIES_MANUSCRIPTS','OPENALEX_CROSSREF_DATACITE','ARCHIVES','OPEN_REPOSITORIES','ISLAMIC_SPECIALIZED','AUDIO_VIDEO','FUTURE_SOURCES']);
  assert.equal(suite.policy.acquisitionIndependentFromPublication, true);
  assert.equal(suite.policy.rightsDoNotBlockLawfulAcquisition, true);
});

test('scholarly and archive connectors perform HTTPS discovery requests', async () => {
  for (const fn of [searchOpenAlex, searchCrossref, searchDataCite, searchInternetArchive]) {
    const result = await fn('كتاب', { fetchImpl: fakeFetch({ ok: true }) });
    assert.deepEqual(result, { ok: true });
  }
});

test('candidate preserves acquisition/publication separation', () => {
  const item = candidate({ adapter: 'IIIF', url: 'https://example.org/book.pdf', rightsStatus: 'UNKNOWN' });
  assert.equal(item.acquisitionIndependentFromPublication, true);
  assert.equal(item.publishable, false);
  assert.equal(item.rightsStatus, 'UNKNOWN');
});
