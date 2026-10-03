import test from 'node:test';
import assert from 'node:assert/strict';
import { createResearchProviderEngine, getProvider, providersForEngine, recordProviderAttempt, buildResearchFallback, providerHealth } from '../src/rechercher-global-research-provider-engine.js';

test('registers official/public research providers', () => {
  const e = createResearchProviderEngine();
  assert.ok(e.providers.size >= 8);
  assert.equal(getProvider(e, 'openalex').family, 'SCHOLARLY_GRAPH');
  assert.equal(getProvider(e, 'iiif').family, 'DIGITAL_OBJECT');
  assert.equal(getProvider(e, 'openiti').family, 'ISLAMIC_CORPUS');
});

test('maps discovery engines to multiple providers', () => {
  const e = createResearchProviderEngine();
  const providers = providersForEngine(e, 'CATALOG_DISCOVERY');
  assert.ok(providers.length >= 4);
});

test('provider failure is recorded without stopping the engine', () => {
  const e = createResearchProviderEngine();
  recordProviderAttempt(e, { providerId:'openalex', query:'kitab', status:'ERROR', error:'temporary failure' });
  recordProviderAttempt(e, { providerId:'crossref', query:'kitab', status:'SUCCESS', candidateCount:3 });
  assert.equal(e.failures.length, 1);
  assert.equal(e.traces.length, 2);
  assert.equal(providerHealth(e).status, 'IMPLEMENTED_FOUNDATION');
});

test('fallback excludes failed providers and preserves lawful source metadata', () => {
  const e = createResearchProviderEngine();
  const plan = buildResearchFallback(e, 'WORK_SEARCH', ['openalex']);
  assert.ok(plan.length >= 1);
  assert.ok(plan.every((step) => step.providerId !== 'openalex'));
  assert.ok(plan.every((step) => step.baseUrl && step.family));
});
