import test from 'node:test';
import assert from 'node:assert/strict';
import SOURCES from '../config/rechercher-global-structured-knowledge-sources-v1.js';

const byId = new Map(SOURCES.map((source) => [source.id, source]));

test('global structured sources are source-backed and API-agnostic when API is not verified', () => {
  for (const source of SOURCES) {
    assert.equal(source.kind, 'structured-knowledge-source');
    assert.ok(source.sourceUrl);
    assert.ok(source.verification);
    assert.equal(source.discoveryDoesNotGrantDownloadRights, true);
    if (source.apiDiscoveryStatus === 'actively-seeking' || source.apiDiscoveryStatus === 'api-agnostic-structured-corpus') {
      assert.ok(!source.connector || source.connector.kind === 'web-discovery');
    }
  }
});

test('global federation contains the five new knowledge sources', () => {
  for (const id of ['quran-foundation', 'sunnah-com', 'openiti', 'altafsir', 'tdv-islam-ansiklopedisi']) {
    assert.ok(byId.has(id), `missing global source: ${id}`);
  }
});

test('Quran Foundation exposes the documented content surface without storing credentials', () => {
  const source = byId.get('quran-foundation');
  assert.equal(source.apiDiscoveryStatus, 'verified-first-party-documentation');
  assert.equal(source.auth, 'oauth2-client-credentials');
  assert.ok(source.documentedEndpoints.includes('/chapters'));
  assert.ok(source.documentedEndpoints.includes('/verses'));
  assert.ok(source.documentedEndpoints.includes('/translations'));
  assert.ok(source.documentedEndpoints.includes('/tafsirs'));
  assert.ok(source.documentedEndpoints.includes('/resources/snapshots/{resource_group}/{resource_id}'));
  assert.equal(Object.hasOwn(source, 'clientSecret'), false);
});

test('Sunnah.com is promoted only from its first-party OpenAPI contract', () => {
  const source = byId.get('sunnah-com');
  assert.equal(source.apiDiscoveryStatus, 'verified-first-party-openapi');
  assert.ok(source.documentedEndpoints.includes('/collections'));
  assert.ok(source.documentedEndpoints.includes('/collections/{collectionName}/books'));
  assert.equal(source.auth, 'api-key');
});

test('OpenITI remains structured-corpus and does not require an invented API', () => {
  const source = byId.get('openiti');
  assert.equal(source.discoveryMode, 'machine-actionable-corpus');
  assert.equal(source.apiDiscoveryStatus, 'api-agnostic-structured-corpus');
  assert.ok(source.formats.includes('TEI XML'));
  assert.ok(source.formats.includes('OpenITI mARkdown'));
});

test('Altafsir and TDV remain structured sources while API discovery continues', () => {
  assert.equal(byId.get('altafsir').apiDiscoveryStatus, 'actively-seeking');
  assert.equal(byId.get('tdv-islam-ansiklopedisi').apiDiscoveryStatus, 'actively-seeking');
  assert.ok(byId.get('altafsir').domains.includes('tafsir'));
  assert.ok(byId.get('tdv-islam-ansiklopedisi').domains.includes('fiqh'));
});
