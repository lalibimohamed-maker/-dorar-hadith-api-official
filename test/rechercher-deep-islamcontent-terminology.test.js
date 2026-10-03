import test from 'node:test';
import assert from 'node:assert/strict';
import sources from '../config/rechercher-islamcontent-terminology-deep-registry-v1.js';
import { createGraph, addNode, addEdge, validateRuntimeGraph } from '../src/deen-graph-runtime.js';
import { NODE_TYPES, EDGE_TYPES } from '../src/deen-graph-contract.js';

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

test('TerminologyEnc is a structured knowledge source with API discovery kept open', () => {
  const item = byId('terminologyenc-deep');
  assert.ok(item);
  assert.equal(item.kind, 'structured-knowledge-source');
  assert.equal(item.apiDiscoveryStatus, 'actively-seeking');
  assert.equal(item.graph.enabled, true);
  assert.equal(item.graph.apiAgnostic, true);
  assert.ok(item.graph.entities.includes('term'));
  assert.ok(item.graph.entities.includes('translation'));
  assert.ok(item.graph.relations.includes('translated_as'));
  assert.ok(item.web.mainCategories.length >= 8);
  assert.ok(item.web.dictionaries.length >= 4);
  assert.deepEqual(item.api.endpoints, []);
});

test('unified graph contract accepts multilingual source entities and provenance edges', () => {
  assert.ok(NODE_TYPES.includes('knowledge_source'));
  assert.ok(NODE_TYPES.includes('term'));
  assert.ok(NODE_TYPES.includes('translation'));
  assert.ok(EDGE_TYPES.includes('has_term'));
  assert.ok(EDGE_TYPES.includes('translated_as'));
  const graph = createGraph();
  addNode(graph, { id: 'knowledge_source:terminologyenc', type: 'knowledge_source', label: 'TerminologyEnc', provenance: { sourceId: 'terminologyenc', citation: 'https://terminologyenc.com/en' } });
  addNode(graph, { id: 'term:terminologyenc:10378', type: 'term', label: 'Axioms', provenance: { sourceId: 'terminologyenc', citation: 'https://terminologyenc.com/en/browse/term/10378' } });
  addEdge(graph, { id: 'edge:1', from: 'knowledge_source:terminologyenc', to: 'term:terminologyenc:10378', type: 'has_term', provenance: { sourceId: 'terminologyenc', citation: 'https://terminologyenc.com/en/browse/term/10378' } });
  assert.equal(validateRuntimeGraph(graph).valid, true);
});

test('deep contracts never grant download rights', () => {
  for (const item of sources) assert.equal(item.rights.discovery, true);
});
