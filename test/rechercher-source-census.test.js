import test from 'node:test';
import assert from 'node:assert/strict';
import { ARAB_COUNTRY_CODES, assertSourceCensus, buildSourceCensus } from '../src/rechercher/source-census.js';

test('Rechercher source census covers all 22 Arab country registries', () => {
  const census = assertSourceCensus();
  assert.equal(ARAB_COUNTRY_CODES.length, 22);
  assert.equal(census.arabCountryCount, 22);
  assert.ok(census.byCountry.SA >= 20);
  assert.deepEqual(census.duplicateIds, []);
  assert.ok(census.totalSourceCount > census.globalSourceCount);
});

test('source census keeps provenance outside Corpus', () => {
  const census = buildSourceCensus();
  assert.match(census.corpusIsolation, /never writes Corpus/i);
  assert.match(census.verifiedNativeProtocolPolicy, /verified/i);
});
