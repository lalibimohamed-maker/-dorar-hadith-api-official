import test from 'node:test';
import assert from 'node:assert/strict';
import sources from '../config/rechercher-islamcontent-terminology-deep-registry-v1.js';

const byId = (id) => sources.find((source) => source.id === id);

test('IslamContent deep contract uses the current official developer downloads', () => {
  const item = byId('islamcontent-deep');
  assert.ok(item);
  assert.equal(item.documentationUrl, 'https://islamcontent.com/en/developers_api');
  assert.match(item.postmanCollectionUrl, /iscontent\.postman_collection\.json$/);
  assert.match(item.postmanEnvironmentUrl, /iscontent\+env\.postman_environment\.json$/);
  assert.equal(item.web.multilingualDiscovery, true);
  assert.equal(item.web.attachmentDiscovery, true);
  assert.equal(item.web.sourceCatalog, true);
  assert.ok(item.web.contentTypes.includes('books'));
  assert.ok(item.web.contentTypes.includes('quran'));
  assert.ok(item.web.contentTypes.includes('audios'));
  assert.ok(item.web.contentTypes.includes('videos'));
  assert.equal(item.api.status, 'documented-pending-live-verification');
  assert.equal(item.api.liveProbeRequired, true);
});

test('TerminologyEnc deep contract captures the complete publisher-visible structure', () => {
  const item = byId('terminologyenc-deep');
  assert.ok(item);
  assert.equal(item.web.categoryDiscovery, true);
  assert.equal(item.web.subcategoryDiscovery, true);
  assert.equal(item.web.termDiscovery, true);
  assert.equal(item.web.translationMatrixDiscovery, true);
  assert.equal(item.web.searchUi, true);
  assert.ok(item.web.mainCategories.length >= 8);
  assert.ok(item.web.dictionaries.length >= 4);
  assert.deepEqual(item.api.endpoints, []);
  assert.equal(item.api.status, 'not-verified');
});

test('deep contracts never grant download rights', () => {
  for (const item of sources) assert.equal(item.rights.discovery, true);
});
