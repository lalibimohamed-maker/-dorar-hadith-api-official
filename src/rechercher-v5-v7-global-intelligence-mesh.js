import { createV5CognitiveEngine, recordConcept, observeAttempt, chooseIntervention, verifyTeachBack, forecastMastery } from './rechercher-v5-cognitive-learning-intelligence-engine.js';
import { createV6GlobalSourceIntelligenceEngine, discoverSource, resolveSourceIdentity, evaluateRights, verifySource } from './rechercher-v6-global-source-intelligence-engine.js';
import { createV7ResearchEvidenceEngine, addNode, addEdge, verifyEdge, findKnowledgeGaps } from './rechercher-v7-research-evidence-graph-engine.js';

export function createGlobalIntelligenceMesh(options = {}) {
  return {
    v5: createV5CognitiveEngine(options),
    v6: createV6GlobalSourceIntelligenceEngine(options),
    v7: createV7ResearchEvidenceEngine(options),
    handoffs: []
  };
}

export function ingestLearningObservation(mesh, concept) {
  return recordConcept(mesh.v5, concept);
}

export function learn(mesh, conceptId, attempt) {
  const state = observeAttempt(mesh.v5, conceptId, attempt);
  const intervention = chooseIntervention(mesh.v5, conceptId);
  mesh.handoffs.push({ from: 'V5', to: 'V6', type: 'LEARNING_TO_SOURCE_INTELLIGENCE', conceptId });
  return { state, intervention, forecast: forecastMastery(mesh.v5, conceptId) };
}

export function verifyLearning(mesh, conceptId, response) {
  return verifyTeachBack(mesh.v5, conceptId, response);
}

export function ingestGlobalSource(mesh, candidate, identity, rightsState, rightsEvidence) {
  discoverSource(mesh.v6, candidate);
  resolveSourceIdentity(mesh.v6, candidate.candidateId, identity);
  evaluateRights(mesh.v6, candidate.candidateId, rightsState, rightsEvidence);
  const source = verifySource(mesh.v6, candidate.candidateId);
  mesh.handoffs.push({ from: 'V6', to: 'V7', type: 'SOURCE_INTELLIGENCE_TO_EVIDENCE', sourceId: source.sourceId });
  return source;
}

export function addResearchNode(mesh, node) { return addNode(mesh.v7, node); }
export function addResearchRelation(mesh, edge) { return addEdge(mesh.v7, edge); }
export function verifyResearchRelation(mesh, edgeId, verification) { return verifyEdge(mesh.v7, edgeId, verification); }
export function researchGaps(mesh, nodeId) { return findKnowledgeGaps(mesh.v7, nodeId); }

export function meshHealth(mesh) {
  return {
    v5: { concepts: mesh.v5.concepts.size, events: mesh.v5.events.length },
    v6: { candidates: mesh.v6.candidates.size, verifiedSources: mesh.v6.sources.size, traces: mesh.v6.traces.length },
    v7: { nodes: mesh.v7.nodes.size, edges: mesh.v7.edges.size, traces: mesh.v7.traces.length },
    handoffs: mesh.handoffs.length
  };
}
