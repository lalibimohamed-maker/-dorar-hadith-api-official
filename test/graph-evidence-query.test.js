import assert from 'node:assert/strict';
import test from 'node:test';
import { queryEvidencePaths, rankEvidencePaths } from '../src/graph-evidence-query.js';

const graph = {
  nodes: [
    { id: 'a', kind: 'ayah' },
    { id: 'h', kind: 'hadith' },
    { id: 't', kind: 'tafsir' },
    { id: 's', kind: 'sirah' }
  ],
  edges: [
    { id: 'e1', from: 'a', to: 'h', type: 'supports', sourceId: 'src-qh', citation: 'c1' },
    { id: 'e2', from: 'h', to: 't', type: 'explains', sourceId: 'src-sh', citation: 'c2' },
    { id: 'e3', from: 'a', to: 's', type: 'has_sirah_context', sourceId: 'src-s', citation: 'c3' },
    { id: 'e4', from: 's', to: 't', type: 'contextualizes', sourceId: 'src-st', citation: 'c4' }
  ]
};

test('finds multiple acyclic evidence paths and preserves provenance', () => {
  const paths = queryEvidencePaths(graph, 'a', 't', { maxDepth: 3 });
  assert.equal(paths.length, 2);
  assert.deepEqual(paths[0].provenance, [
    { sourceId: 'src-qh', citation: 'c1' },
    { sourceId: 'src-sh', citation: 'c2' }
  ]);
});

test('can restrict traversal by destination node kind', () => {
  const paths = queryEvidencePaths(graph, 'a', 't', { allowedKinds: ['hadith', 'tafsir'], maxDepth: 3 });
  assert.equal(paths.length, 1);
});

test('enforces path and result bounds', () => {
  assert.equal(queryEvidencePaths(graph, 'a', 't', { maxDepth: 1 }).length, 0);
  assert.equal(queryEvidencePaths(graph, 'a', 't', { maxPaths: 1 }).length, 1);
});

test('rejects graph edges without provenance', () => {
  assert.throws(() => queryEvidencePaths({ ...graph, edges: [{ id: 'bad', from: 'a', to: 'h' }] }, 'a', 'h'), /Unprovenanced graph edge/);
});

test('ranks shorter evidence paths first', () => {
  const paths = queryEvidencePaths(graph, 'a', 't', { maxDepth: 3 });
  const ranked = rankEvidencePaths(paths);
  assert.ok(ranked[0].edges.length <= ranked[1].edges.length);
});
