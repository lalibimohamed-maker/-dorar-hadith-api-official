import test from 'node:test';
import assert from 'node:assert/strict';
import { createGlobalKnowledgeIntelligenceMesh, registerWorldSource, registerWork, relateMultilingualConcept, detectKnowledgeGap, startResearch, attachDiscovery, synthesizeResearch, verifyResearch } from '../src/rechercher-global-knowledge-intelligence-mesh.js';
import { createV7StageNodeContract } from '../src/rechercher-v7-global-knowledge-evidence-graph-engine.js';

test('V7 contract remains a safe extension point', () => {
  const c = createV7StageNodeContract();
  assert.equal(c.stageId, 'V7_GLOBAL_KNOWLEDGE_EVIDENCE_GRAPH');
  assert.equal(c.status, 'OPEN_EXTENSION_POINT');
  assert.equal(c.safety.canOverrideRights, false);
  assert.equal(c.safety.canMutateOriginalPdf, false);
});

test('mesh registers worldwide sources and work identity without replacing the source', () => {
  const mesh = createGlobalKnowledgeIntelligenceMesh();
  registerWorldSource(mesh, { sourceId: 'source:loc:1', sourceType: 'NATIONAL_LIBRARY', provenance: { catalog: 'official' }, rightsState: 'ALLOWED' });
  registerWorldSource(mesh, { sourceId: 'source:iiif:1', sourceType: 'IIIF', provenance: { manifest: 'official' }, rightsState: 'RESTRICTED' });
  registerWork(mesh, { workId: 'work:1', title: 'Test Work', editions: ['edition:1'] });
  assert.equal(mesh.sources.size, 2);
  assert.equal(mesh.works.get('work:1').editions[0], 'edition:1');
});

test('multilingual intelligence preserves relation semantics', () => {
  const mesh = createGlobalKnowledgeIntelligenceMesh();
  const relation = relateMultilingualConcept(mesh, { sourceTerm: 'تقوى', targetTerm: 'taqwa', relation: 'CLOSE', languagePair: ['ar','en'] });
  assert.equal(relation.relation, 'CLOSE');
});

test('research follows discovery, synthesis, then verification', () => {
  const mesh = createGlobalKnowledgeIntelligenceMesh();
  registerWorldSource(mesh, { sourceId: 'source:1', sourceType: 'BOOK_PDF', provenance: { retrieval: 'official' }, rightsState: 'ALLOWED' });
  const gap = detectKnowledgeGap(mesh, { gapId: 'gap:1', topic: 'missing edition evidence' });
  assert.equal(gap.status, 'OPEN');
  const research = startResearch(mesh, { researchId: 'research:1', question: 'Which edition is this?' });
  assert.equal(research.state, 'DISCOVER');
  assert.equal(attachDiscovery(mesh, 'research:1', 'source:1').state, 'SYNTHESIS');
  assert.equal(synthesizeResearch(mesh, 'research:1', { nodeId: 'synthesis:1', content: 'candidate answer' }).state, 'VERIFICATION');
  const verified = verifyResearch(mesh, 'research:1', { sourceNodeId: 'research:research:1', relation: 'SUPPORTS', provenance: { sourceId: 'source:1' }, confidence: 0.5 });
  assert.deepEqual(verified.evidenceEdgeIds, ['evidence:research:1']);
  assert.equal(mesh.graph.edges.length, 1);
});
