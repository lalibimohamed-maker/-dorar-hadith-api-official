import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GRAPH_FAMILIES,
  MATCH_TYPES,
  createNode,
  createEdge,
  createAttributionGraph,
  createScholarGraph,
  createHadithChainGraph,
  createFiqhDisagreementGraph,
  alignEvidenceAcrossLanguages,
  buildMultilingualEvidenceGraph,
  verifyGraph,
} from '../src/rechercher-v7-evidence-graph-engine.js';

const provenance = { sourceIds: ['source-1'], locator: 'page:12' };

function node(nodeId, kind) {
  return createNode({ nodeId, kind, provenance, sourceIdentity: `source:${nodeId}` });
}

test('V7 exposes the five graph families', () => {
  assert.deepEqual(GRAPH_FAMILIES, [
    'ATTRIBUTION',
    'SCHOLAR',
    'HADITH_CHAIN',
    'FIQH_DISAGREEMENT',
    'MULTILINGUAL_EVIDENCE',
  ]);
});

test('attribution and scholar graphs preserve provenance and endpoints', () => {
  const a = node('work-1', 'WORK');
  const b = node('scholar-1', 'SCHOLAR');
  const edge = createEdge({ edgeId: 'edge-1', from: 'scholar-1', to: 'work-1', relation: 'AUTHORED', provenance });
  assert.equal(createAttributionGraph({ nodes: [a, b], edges: [edge] }).edges.length, 1);
  assert.equal(createScholarGraph({ nodes: [a, b], edges: [edge] }).nodes.length, 2);
});

test('hadith chain rejects unrelated edge types', () => {
  const a = node('narrator-1', 'NARRATOR');
  const b = node('narrator-2', 'NARRATOR');
  const edge = createEdge({ edgeId: 'edge-1', from: a.nodeId, to: b.nodeId, relation: 'NARRATED_BY', provenance });
  assert.equal(createHadithChainGraph({ nodes: [a, b], edges: [edge] }).family, 'HADITH_CHAIN');
});

test('fiqh disagreement graph keeps disagreement explicit', () => {
  const a = node('opinion-a', 'FIQH_OPINION');
  const b = node('opinion-b', 'FIQH_OPINION');
  const edge = createEdge({ edgeId: 'edge-1', from: a.nodeId, to: b.nodeId, relation: 'DIFFERS_FROM', provenance });
  assert.equal(createFiqhDisagreementGraph({ nodes: [a, b], edges: [edge] }).edges[0].relation, 'DIFFERS_FROM');
});

test('multilingual evidence alignment preserves no-exact-equivalent semantics', () => {
  const a = node('evidence-ar', 'EVIDENCE');
  const b = node('evidence-en', 'EVIDENCE');
  const alignment = alignEvidenceAcrossLanguages({
    alignmentId: 'align-1',
    sourceEvidenceId: a.nodeId,
    targetEvidenceId: b.nodeId,
    sourceLanguage: 'ar',
    targetLanguage: 'en',
    matchType: 'NO_EXACT_EQUIVALENT',
    confidence: 0.71,
    provenance,
  });
  assert.equal(alignment.matchType, 'NO_EXACT_EQUIVALENT');
  assert.equal(buildMultilingualEvidenceGraph({ nodes: [a, b], alignments: [alignment] }).edges[0].relation, 'NO_EXACT_EQUIVALENT');
});

test('multilingual alignment rejects unsupported match semantics', () => {
  assert.ok(MATCH_TYPES.includes('SCHOOL_SPECIFIC'));
  assert.throws(() => alignEvidenceAcrossLanguages({
    alignmentId: 'bad',
    sourceEvidenceId: 'a',
    targetEvidenceId: 'b',
    sourceLanguage: 'ar',
    targetLanguage: 'fr',
    matchType: 'MADE_UP',
    provenance,
  }), /unsupported match type/);
});

test('graphs fail closed on missing endpoints and missing provenance', () => {
  assert.throws(() => createEdge({ edgeId: 'e', from: 'a', to: 'b', relation: 'SUPPORTS' }), /provenance is required/);
  assert.throws(() => createAttributionGraph({ nodes: [node('a', 'WORK')], edges: [createEdge({ edgeId: 'e', from: 'a', to: 'missing', relation: 'SUPPORTS', provenance })] }), /missing graph endpoint/);
});

test('verification requires scholarly review', () => {
  const graph = createScholarGraph({ nodes: [node('s', 'SCHOLAR')], edges: [] });
  assert.throws(() => verifyGraph(graph, { reviewState: 'REVIEW_REQUIRED' }), /scholarly review is required/);
  assert.equal(verifyGraph(graph, { reviewState: 'SCHOLAR_REVIEWED' }).reviewState, 'VERIFIED');
});

test('immutable source identity fields remain carried on nodes', () => {
  const n = createNode({
    nodeId: 'page-1',
    kind: 'PAGE',
    provenance,
    sourceIdentity: 'immutable-source',
    contentHash: 'sha256:abc',
    originalPdf: 'book.pdf',
    canonicalQuranArabic: 'canonical-arabic',
  });
  assert.equal(n.sourceIdentity, 'immutable-source');
  assert.equal(n.contentHash, 'sha256:abc');
  assert.equal(n.originalPdf, 'book.pdf');
  assert.equal(n.canonicalQuranArabic, 'canonical-arabic');
});
