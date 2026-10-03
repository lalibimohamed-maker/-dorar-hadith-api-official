import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createV4LearningIntelligenceEngine,
  addGraphNode,
  diagnoseKnowledgeGap,
  buildLearningPaths,
  recoverBlockedLearning,
  explainPersonalizedRecommendation,
  addEvidenceTrail,
  recordContradiction,
  calibrateConfidence,
  getV4Capabilities,
} from '../src/rechercher-learning-intelligence-v4-engine.js';

test('V4 exposes the four knowledge graph layers', () => {
  const engine = createV4LearningIntelligenceEngine();
  const caps = getV4Capabilities();
  assert.deepEqual(caps.graphLayers, ['SOURCE_GRAPH','DOMAIN_ONTOLOGY','LEARNING_RESOURCE_GRAPH','LEARNER_STATE_GRAPH']);
  addGraphNode(engine, 'SOURCE_GRAPH', 's1', { sourceHash: 'h1' });
  addGraphNode(engine, 'DOMAIN_ONTOLOGY', 'd1');
  addGraphNode(engine, 'LEARNING_RESOURCE_GRAPH', 'r1');
  addGraphNode(engine, 'LEARNER_STATE_GRAPH', 'l1');
  for (const layer of caps.graphLayers) assert.equal(engine.graphs[layer].size, 1);
});

test('V4 diagnoses gaps and builds prerequisite/similarity paths', () => {
  const engine = createV4LearningIntelligenceEngine();
  const gap = diagnoseKnowledgeGap(engine, { learnerId: 'u1', conceptId: 'c2', mastery: 0.2, failedPrerequisiteIds: ['c1'] });
  assert.equal(gap.severity, 'BLOCKING');
  const path = buildLearningPaths(engine, { startId: 'c2', prerequisiteIds: ['c1'], similarIds: ['c3'] });
  assert.equal(path.paths.length, 2);
  assert.equal(path.paths[0].type, 'PREREQUISITE');
  assert.equal(path.paths[1].type, 'SIMILARITY');
});

test('V4 blocked-learning recovery and explainable recommendations retain evidence', () => {
  const engine = createV4LearningIntelligenceEngine();
  const recovery = recoverBlockedLearning(engine, { learnerId: 'u1', conceptId: 'c2', blockers: ['c1'], alternatives: ['c0'], prerequisiteIds: ['c1'] });
  assert.equal(recovery.status, 'RECOVERY_REQUIRED');
  const rec = explainPersonalizedRecommendation(engine, { learnerId: 'u1', itemId: 'r1', reasons: ['prerequisite-gap'], sourceIds: ['s1'], confidence: 0.8 });
  assert.equal(rec.explainable, true);
  assert.deepEqual(rec.sourceIds, ['s1']);
});

test('V4 evidence trails are source-hash linked and contradictions are preserved', () => {
  const engine = createV4LearningIntelligenceEngine();
  const trail = addEvidenceTrail(engine, { claimId: 'c1', sourceId: 's1', sourceHash: 'sha256:x', locator: 'p.10', rightsStatus: 'ALLOWED' });
  assert.equal(trail.immutableSourceLink, true);
  const contradiction = recordContradiction(engine, { claimId: 'c1', evidenceIds: [trail.trailId], description: 'two sources differ' });
  assert.equal(contradiction.preserved, true);
});

test('V4 confidence calibration records prediction error', () => {
  const engine = createV4LearningIntelligenceEngine();
  const c = calibrateConfidence(engine, { learnerId: 'u1', predictionId: 'p1', predicted: 0.8, outcome: true });
  assert.equal(c.absoluteError, 0.2);
  assert.equal(c.calibratedScore, 0.8);
});

test('V4 safety contract is non-bypassable', () => {
  const safety = getV4Capabilities().safety;
  assert.equal(safety.acquisitionControl, false);
  assert.equal(safety.rightsBypass, false);
  assert.equal(safety.sourceMutation, false);
  assert.equal(safety.quranCanonicalMutation, false);
  assert.equal(safety.scholarlyDisagreementErasure, false);
  assert.equal(safety.unauditedAiAuthority, false);
});
