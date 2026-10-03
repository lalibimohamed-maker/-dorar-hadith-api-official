import test from 'node:test';
import assert from 'node:assert/strict';
import { createV7GlobalKnowledgeEvidenceGraphEngine, addNode, addEvidenceEdge, recordClaim, recordContradiction, registerGraph, createAiSynthesis, canAuthoritativelyUse } from '../src/rechercher-v7-global-knowledge-evidence-graph-engine.js';

test('V7 supports specialized graph families and immutable trust boundaries', () => {
  const engine = createV7GlobalKnowledgeEvidenceGraphEngine();
  const source = addNode(engine, { nodeId: 'source:1', graphType: 'SOURCE', sourceIdentity: 'source:1', contentHash: 'sha256:a', reviewState: 'HUMAN_REVIEWED' });
  const claim = addNode(engine, { nodeId: 'claim:1', graphType: 'CLAIM' });
  const edge = addEvidenceEdge(engine, { edgeId: 'edge:1', from: source.nodeId, to: claim.nodeId, relation: 'SUPPORTS', provenance: { sourceId: source.nodeId }, confidence: 0.9, uncertainty: 0.1 });
  assert.equal(edge.relation, 'SUPPORTS');
  assert.equal(registerGraph(engine, 'graph:hadith', 'HADITH_CHAIN').graphType, 'HADITH_CHAIN');
  assert.equal(engine.edges.length, 1);
});

test('AI synthesis remains unverified and cannot be authoritative without review', () => {
  const engine = createV7GlobalKnowledgeEvidenceGraphEngine();
  const synthesis = createAiSynthesis(engine, { nodeId: 'ai:1', content: 'candidate' });
  assert.equal(synthesis.reviewState, 'UNVERIFIED');
  assert.equal(canAuthoritativelyUse(synthesis), false);
  assert.equal(canAuthoritativelyUse({ reviewState: 'SCHOLAR_REVIEWED' }), true);
});

test('V7 records claims, contradictions and uncertainty without silently resolving disagreement', () => {
  const engine = createV7GlobalKnowledgeEvidenceGraphEngine();
  recordClaim(engine, { claimId: 'claim:a', text: 'A', uncertainty: 0.4 });
  recordClaim(engine, { claimId: 'claim:b', text: 'B', uncertainty: 0.6 });
  const contradiction = recordContradiction(engine, { contradictionId: 'contra:1', claimA: 'claim:a', claimB: 'claim:b', confidence: 0.7, provenance: { source: 'test' } });
  assert.equal(contradiction.reviewState, 'UNVERIFIED');
  assert.equal(engine.contradictions.length, 1);
});
