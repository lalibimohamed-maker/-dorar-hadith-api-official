import assert from 'node:assert/strict';
import test from 'node:test';
import { createGraph, addNode, addEdge, addEvidence, neighbors, validateRuntimeGraph } from '../src/deen-graph-runtime.js';

test('graph accepts source-backed nodes and relations', () => {
  const graph = createGraph();
  addNode(graph, { id: 'q:1', type: 'quran_verse', provenance: { sourceId: 'quran', citation: '1:1' } });
  addNode(graph, { id: 'h:1', type: 'hadith', provenance: { sourceId: 'bukhari', citation: '1' } });
  addEdge(graph, { id: 'e:1', from: 'h:1', to: 'q:1', type: 'related_to', provenance: { sourceId: 'bukhari', citation: '1' } });
  addEvidence(graph, { nodeId: 'h:1', evidence: { sourceId: 'bukhari', citation: 'Sahih al-Bukhari 1', verificationState: 'source_verified' } });
  assert.equal(neighbors(graph, 'h:1')[0].id, 'q:1');
  assert.equal(validateRuntimeGraph(graph).valid, true);
});

test('graph rejects generated evidence as source-backed evidence', () => {
  const graph = createGraph();
  addNode(graph, { id: 'h:1', type: 'hadith', provenance: { sourceId: 'bukhari', citation: '1' } });
  assert.throws(() => addEvidence(graph, { nodeId: 'h:1', evidence: { generated: true, sourceId: 'ai', citation: 'generated' } }), /Generated content/);
});

test('graph rejects dangling edges', () => {
  const graph = createGraph();
  addNode(graph, { id: 'h:1', type: 'hadith', provenance: { sourceId: 'bukhari', citation: '1' } });
  assert.throws(() => addEdge(graph, { id: 'e:1', from: 'h:1', to: 'missing', type: 'related_to', provenance: { sourceId: 'x', citation: 'x' } }), /endpoints/);
});
