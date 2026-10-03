import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGlobalSourceDiscoveryEngine,
  registerDiscoveryProvider,
  rankProviders,
  recordCandidate,
  recordProviderFailure,
  buildFallbackPlan,
  bestCandidate,
  discoveryHealth
} from '../src/rechercher-global-source-discovery-engine.js';

test('global discovery ranks independent providers and exposes fallback plans', () => {
  const engine = createGlobalSourceDiscoveryEngine();
  registerDiscoveryProvider(engine, { id: 'iiif', priority: 10, scope: 'MANUSCRIPTS', discovery: 'IIIF_MANIFEST', download: 'CANVAS_RESOURCES', rights: 'SOURCE_RECORD', engines: ['MANIFEST_DISCOVERY'] });
  registerDiscoveryProvider(engine, { id: 'openalex', priority: 8, scope: 'SCHOLARLY', discovery: 'REST_API', download: 'METADATA_AND_OA_LOCATIONS', rights: 'METADATA_OPEN', engines: ['WORK_SEARCH'] });
  registerDiscoveryProvider(engine, { id: 'crossref', priority: 7, scope: 'SCHOLARLY', discovery: 'REST_API', download: 'FULLTEXT_LINKS_WHEN_PROVIDED', rights: 'METADATA_OPEN', engines: ['WORK_SEARCH'] });
  assert.deepEqual(rankProviders(engine, { scope: 'SCHOLARLY', engineName: 'WORK_SEARCH' }).map((x) => x.id), ['openalex', 'crossref']);
  assert.deepEqual(buildFallbackPlan(engine, { scope: 'SCHOLARLY', engineName: 'WORK_SEARCH' }).map((x) => x.providerId), ['openalex', 'crossref']);
});

test('provider failure is recorded without terminating discovery', () => {
  const engine = createGlobalSourceDiscoveryEngine();
  registerDiscoveryProvider(engine, { id: 'a', priority: 10, discovery: 'API_DISCOVERY' });
  registerDiscoveryProvider(engine, { id: 'b', priority: 9, discovery: 'API_DISCOVERY' });
  recordProviderFailure(engine, { providerId: 'a', query: 'book', reason: 'timeout' });
  const plan = buildFallbackPlan(engine, { excludeProviderIds: ['a'] });
  assert.equal(plan[0].providerId, 'b');
  assert.equal(engine.failures.length, 1);
});

test('candidate quality selects the best verified lawful manifestation', () => {
  const engine = createGlobalSourceDiscoveryEngine();
  registerDiscoveryProvider(engine, { id: 'source-a', priority: 10, discovery: 'API_DISCOVERY' });
  recordCandidate(engine, { candidateId: 'a', providerId: 'source-a', verified: true, publishable: true, qualityScore: 81 });
  recordCandidate(engine, { candidateId: 'b', providerId: 'source-a', verified: true, publishable: true, qualityScore: 96 });
  recordCandidate(engine, { candidateId: 'c', providerId: 'source-a', verified: true, publishable: false, qualityScore: 100 });
  assert.equal(bestCandidate(engine, [...engine.candidates.values()]).candidateId, 'b');
  assert.equal(discoveryHealth(engine).candidates, 3);
});
