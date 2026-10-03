import assert from 'node:assert/strict';
import test from 'node:test';
import { queryEvidencePaths } from '../src/graph-evidence-query.js';

const graph = {
  nodes: [
    { id: 'q1', type: 'quran_verse', provenance: { sourceId: 'quran', citation: '1:1', verificationState: 'source_verified' } },
    { id: 't1', type: 'tafsir', provenance: { sourceId: 'tafsir', citation: 't1', verificationState: 'edition_verified' } },
    { id: 'h1', type: 'hadith', provenance: { sourceId: 'bukhari', citation: 'h1', verificationState: 'scholar_reviewed' } }
  ],
  edges: [
    { id: 'e1', from: 'q1', to: 't1', type: 'explains', provenance: { sourceId: 'quran', citation: '1:1', verificationState: 'source_verified' } },
    { id: 'e2', from: 't1', to: 'h1', type: 'related_to', provenance: { sourceId: 'tafsir', citation: 't1', verificationState: 'edition_verified' } }
  ]
};

test('evidence paths require edge provenance and expose verification state', () => {
  const paths = queryEvidencePaths(graph, 'q1', 'h1', { requireTrusted: true });
  assert.equal(paths.length, 1);
  assert.equal(paths[0].edges[0].provenance.citation, '1:1');
  assert.equal(paths[0].provenance[0].verificationState, 'source_verified');
});

test('reverse traversal works over the same graph contract', () => {
  const paths = queryEvidencePaths(graph, 'h1', 'q1', { direction: 'both', requireTrusted: true });
  assert.equal(paths.length, 1);
  assert.deepEqual(paths[0].nodes, ['h1', 't1', 'q1']);
  assert.equal(paths[0].edges[0].traversalDirection, 'reverse');
});

test('unverified graph paths stay out of trusted evidence traversal', () => {
  const unverified = structuredClone(graph);
  unverified.edges[1].provenance.verificationState = 'pending_verification';
  const paths = queryEvidencePaths(unverified, 'q1', 'h1', { requireTrusted: true });
  assert.equal(paths.length, 0);
});
