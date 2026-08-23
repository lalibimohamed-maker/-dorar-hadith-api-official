import assert from 'node:assert/strict';
import test from 'node:test';
import { explainEvidencePath, findEvidencePaths, validateEvidenceGraph } from '../src/evidence-path-traversal.js';

const graph = {
  nodes: [{ id: 'a', kind: 'ayah' }, { id: 'h', kind: 'hadith' }, { id: 's', kind: 'sharh' }],
  edges: [
    { id: 'e1', from: 'a', to: 'h', type: 'supports', sourceId: 'src-qh', citation: 'c1' },
    { id: 'e2', from: 'h', to: 's', type: 'explains', sourceId: 'src-sh', citation: 'c2' }
  ]
};

test('validates source-backed graph edges', () => assert.equal(validateEvidenceGraph(graph), true));

test('rejects unprovenanced edges and unknown endpoints', () => {
  assert.throws(() => validateEvidenceGraph({ ...graph, edges: [{ ...graph.edges[0], citation: '' }] }), /Unprovenanced/);
  assert.throws(() => validateEvidenceGraph({ ...graph, edges: [{ ...graph.edges[0], to: 'missing' }] }), /Unknown graph endpoint/);
});

test('finds bounded evidence paths without cycles', () => {
  const paths = findEvidencePaths(graph, 'a', 's', { maxDepth: 4 });
  assert.equal(paths.length, 1);
  assert.deepEqual(paths[0].nodes.map(n => n.id), ['a', 'h', 's']);
});

test('explains each hop with its provenance', () => {
  const paths = findEvidencePaths(graph, 'a', 's');
  assert.deepEqual(explainEvidencePath(paths[0]), [
    { from: 'a', relation: 'supports', to: 'h', sourceId: 'src-qh', citation: 'c1' },
    { from: 'h', relation: 'explains', to: 's', sourceId: 'src-sh', citation: 'c2' }
  ]);
});
