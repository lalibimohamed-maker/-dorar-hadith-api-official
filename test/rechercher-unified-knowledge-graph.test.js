import test from 'node:test';
import assert from 'node:assert/strict';
import DEEP_SOURCES from '../config/rechercher-islamcontent-terminology-deep-registry-v1.js';
import { VERIFIED_MULTILINGUAL_CONNECTORS } from '../config/rechercher-verified-multilingual-connectors.js';
import { NODE_TYPES, EDGE_TYPES } from '../src/deen-graph-contract.js';

test('TerminologyEnc is a structured knowledge source and remains API-agnostic', () => {
  const source = DEEP_SOURCES.find((x) => x.id === 'terminologyenc-deep');
  assert.ok(source);
  assert.equal(source.kind, 'structured-knowledge-source');
  assert.equal(source.apiDiscoveryStatus, 'actively-seeking');
  assert.equal(source.graph.enabled, true);
  assert.equal(source.graph.apiAgnostic, true);
  assert.deepEqual(source.api.endpoints, []);
});

test('IslamContent participates in the same graph without granting acquisition rights', () => {
  const source = DEEP_SOURCES.find((x) => x.id === 'islamcontent-deep');
  assert.ok(source);
  assert.equal(source.kind, 'documented-api-plus-web-discovery');
  assert.equal(source.rights.discovery, true);
  assert.equal(source.rights.acquisition, 'verify-per-item-rights');
});

test('verified multilingual sources expose the four native API families', () => {
  const ids = new Set(VERIFIED_MULTILINGUAL_CONNECTORS.map((x) => x.id));
  for (const id of ['quranenc', 'hadeethenc-api', 'islamenc-api']) assert.ok(ids.has(id), `missing ${id}`);
});

test('unified graph contract contains multilingual source entity and relationship types', () => {
  for (const type of ['knowledge_source','source_service','language','category','subcategory','term','translation','dictionary','reference','source_record']) assert.ok(NODE_TYPES.includes(type), `missing node type ${type}`);
  for (const type of ['provides','offers_service','supports_language','has_category','has_subcategory','has_term','translated_as','has_dictionary','has_reference','same_source_as','discovered_from']) assert.ok(EDGE_TYPES.includes(type), `missing edge type ${type}`);
});
