import { createStageNodeContract } from './rechercher-stage-node-contract.js';

export const V7_STAGE_ID = 'V7_GLOBAL_RESEARCH_EVIDENCE_GRAPH';
export const V7_EDGE_STATES = Object.freeze(['UNVERIFIED', 'SUPPORTED', 'DISPUTED', 'REFUTED', 'HYPOTHESIS']);
export const V7_NODE_TYPES = Object.freeze(['SCHOLAR','WORK','EDITION','MANUSCRIPT','PAGE','PASSAGE','CLAIM','EVIDENCE','HADITH','NARRATOR','SOURCE','ISSUE','OPINION','EVENT','TRANSLATION']);

function clone(value) { return structuredClone(value); }
function requireId(value, name) { if (!value) throw new TypeError(`${name} is required`); }

export function createV7ResearchEvidenceContract() {
  return createStageNodeContract({
    stageId: V7_STAGE_ID,
    version: '1.0',
    capabilities: [
      'EVIDENCE_GRAPH','SOURCE_GRAPH','ATTRIBUTION_GRAPH','SCHOLAR_GRAPH',
      'HADITH_CHAIN_GRAPH','FIQH_DISAGREEMENT_GRAPH','SIRAH_EVENT_GRAPH',
      'MANUSCRIPT_EDITION_GRAPH','CLAIM_GRAPH','CONTRADICTION_GRAPH',
      'PROVENANCE_TRAIL','UNCERTAINTY_TRACKING','KNOWLEDGE_GAP_GRAPH'
    ],
    acceptedInputs: [{ type: 'VERIFIED_SOURCE' }, { type: 'LEARNING_STATE' }],
    producedOutputs: [{ type: 'EVIDENCE_GRAPH_OUTPUT' }],
    requiredEvidence: [{ type: 'SOURCE_IDENTITY' }, { type: 'PROVENANCE' }, { type: 'RIGHTS_STATE' }],
    rightsPolicy: { defaultState: 'UNKNOWN', publishableState: 'ALLOWED', unknownIsPublishable: false, restrictedIsPublishable: false },
    reviewPolicy: { scholarlyVerification: true, humanReviewForAuthoritativeUse: true },
    dependencies: ['V5_GLOBAL_RESEARCH', 'V6_GLOBAL_SOURCE_INTELLIGENCE'],
    handoffs: ['SOURCE_INTELLIGENCE_TO_EVIDENCE', 'EVIDENCE_TO_LEARNING'],
    tracePolicy: { traceIdRequired: true },
    status: 'OPEN_EXTENSION_POINT'
  });
}

export function createV7ResearchEvidenceEngine({ now = () => Date.now() } = {}) {
  return { stageId: V7_STAGE_ID, status: 'FOUNDATION_IMPLEMENTED_EXTENSION_POINT', nodes: new Map(), edges: new Map(), traces: [], now };
}

export function addNode(engine, node) {
  requireId(node?.id, 'node.id');
  if (!V7_NODE_TYPES.includes(node.type)) throw new TypeError(`invalid V7 node type: ${node.type}`);
  const record = { ...clone(node), provenance: clone(node.provenance || null), reviewState: node.reviewState || 'UNREVIEWED' };
  engine.nodes.set(node.id, record);
  trace(engine, 'NODE_ADDED', { id: node.id, type: node.type });
  return clone(record);
}

export function addEdge(engine, edge) {
  requireId(edge?.id, 'edge.id');
  requireId(edge?.from, 'edge.from');
  requireId(edge?.to, 'edge.to');
  requireId(edge?.relation, 'edge.relation');
  if (!engine.nodes.has(edge.from) || !engine.nodes.has(edge.to)) throw new Error('edge endpoints must exist');
  const state = edge.state || (edge.createdBy === 'AI' ? 'UNVERIFIED' : 'HYPOTHESIS');
  if (!V7_EDGE_STATES.includes(state)) throw new TypeError(`invalid V7 edge state: ${state}`);
  const record = {
    ...clone(edge), state,
    confidence: Number.isFinite(edge.confidence) ? edge.confidence : 0,
    provenance: clone(edge.provenance || null),
    evidenceIds: [...(edge.evidenceIds || [])],
    reviewState: edge.reviewState || 'UNREVIEWED',
    createdAt: new Date(engine.now()).toISOString()
  };
  engine.edges.set(edge.id, record);
  trace(engine, 'EDGE_ADDED', { id: edge.id, state, createdBy: edge.createdBy || 'HUMAN' });
  return clone(record);
}

export function verifyEdge(engine, edgeId, { evidenceIds = [], reviewer = null, state = 'SUPPORTED' } = {}) {
  const edge = engine.edges.get(edgeId);
  if (!edge) throw new Error('edge not found');
  if (!evidenceIds.length) throw new Error('evidence is required before verification');
  if (!reviewer) throw new Error('reviewer is required before authoritative verification');
  if (!V7_EDGE_STATES.includes(state) || state === 'UNVERIFIED' || state === 'HYPOTHESIS') throw new Error('invalid authoritative edge state');
  const updated = { ...clone(edge), evidenceIds: [...evidenceIds], reviewer, reviewState: 'SCHOLAR_REVIEWED', state };
  engine.edges.set(edgeId, updated);
  trace(engine, 'EDGE_VERIFIED', { edgeId, state, reviewer });
  return clone(updated);
}

export function recordContradiction(engine, claimA, claimB, evidenceIds = []) {
  requireId(claimA, 'claimA'); requireId(claimB, 'claimB');
  const id = `contradiction:${engine.traces.length + 1}`;
  return addEdge(engine, { id, from: claimA, to: claimB, relation: 'CONTRADICTS', state: 'DISPUTED', evidenceIds, createdBy: 'HUMAN' });
}

export function findKnowledgeGaps(engine, nodeId) {
  if (!engine.nodes.has(nodeId)) throw new Error('node not found');
  const incoming = [...engine.edges.values()].filter(e => e.to === nodeId);
  const unresolved = incoming.filter(e => e.state === 'UNVERIFIED' || e.state === 'HYPOTHESIS' || e.state === 'DISPUTED');
  return { nodeId, evidenceCount: incoming.length, unresolvedCount: unresolved.length, gaps: unresolved.map(e => ({ edgeId: e.id, relation: e.relation, state: e.state })) };
}

export function trace(engine, type, payload = {}) {
  const event = { traceId: `rechercher-v7-trace-${engine.traces.length + 1}`, type, at: new Date(engine.now()).toISOString(), ...clone(payload) };
  engine.traces.push(event);
  return event.traceId;
}
