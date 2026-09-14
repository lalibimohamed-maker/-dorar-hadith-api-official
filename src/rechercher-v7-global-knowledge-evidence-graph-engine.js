import { createStageNodeContract } from './rechercher-stage-node-contract.js';
import { registerNode } from './rechercher-stage-network-registry.js';

export const V7_STAGE_ID = 'V7_GLOBAL_KNOWLEDGE_EVIDENCE_GRAPH';
export const EVIDENCE_RELATIONS = Object.freeze(['SUPPORTS','REFUTES','QUALIFIES','DERIVED_FROM','CONTRADICTS','CITES','SAME_WORK','SAME_EDITION']);
export const REVIEW_STATES = Object.freeze(['UNVERIFIED','HUMAN_REVIEWED','SCHOLAR_REVIEWED','REJECTED']);

const clone = value => structuredClone(value);
const immutableFields = ['sourceIdentity','contentHash','canonicalQuranArabic','originalPdf'];

export function createV7StageNodeContract() {
  return createStageNodeContract({
    stageId: V7_STAGE_ID,
    version: '1.0',
    capabilities: ['GLOBAL_KNOWLEDGE_GRAPH','GLOBAL_EVIDENCE_GRAPH','CONTRADICTION_TRACKING','UNCERTAINTY_TRACKING','TRUST_LAYER','KNOWLEDGE_GAP_LINKING'],
    acceptedInputs: [{ type: 'VERIFIED_SOURCE' }],
    producedOutputs: [{ type: 'EVIDENCE_GRAPH_UPDATE' }],
    requiredEvidence: [{ type: 'SOURCE_IDENTITY' }, { type: 'PROVENANCE' }, { type: 'RIGHTS_STATE' }],
    rightsPolicy: { defaultState: 'UNKNOWN', publishableState: 'ALLOWED', unknownIsPublishable: false, restrictedIsPublishable: false },
    reviewPolicy: { scholarlyVerification: true, humanReviewForAuthoritativeUse: true },
    dependencies: ['V6_GLOBAL_SOURCE_INTELLIGENCE'],
    handoffs: ['SOURCE_INTELLIGENCE_TO_EVIDENCE','EVIDENCE_TO_LEARNING'],
    tracePolicy: { traceIdRequired: true },
    status: 'OPEN_EXTENSION_POINT'
  });
}

export function registerV7Node(registry) { return registerNode(registry, createV7StageNodeContract()); }

export function createV7GlobalKnowledgeEvidenceGraphEngine() {
  return { stageId: V7_STAGE_ID, status: 'FOUNDATION_IMPLEMENTED_EXTENSION_POINT', nodes: new Map(), edges: [], claims: new Map(), gaps: new Map(), traces: [] };
}

function required(value, name) { if (!value) throw new TypeError(`${name} is required`); }

export function addNode(engine, node) {
  required(node?.nodeId, 'nodeId');
  const value = clone(node);
  value.reviewState = value.reviewState || 'UNVERIFIED';
  if (!REVIEW_STATES.includes(value.reviewState)) throw new TypeError('invalid reviewState');
  engine.nodes.set(value.nodeId, value);
  return clone(value);
}

export function addEvidenceEdge(engine, edge) {
  required(edge?.edgeId, 'edgeId'); required(edge?.from, 'from'); required(edge?.to, 'to'); required(edge?.relation, 'relation');
  if (!EVIDENCE_RELATIONS.includes(edge.relation)) throw new TypeError('invalid evidence relation');
  if (!engine.nodes.has(edge.from) || !engine.nodes.has(edge.to)) throw new Error('edge endpoints must exist');
  const value = { ...clone(edge), reviewState: edge.reviewState || 'UNVERIFIED', confidence: edge.confidence ?? null, provenance: clone(edge.provenance || null) };
  if (!REVIEW_STATES.includes(value.reviewState)) throw new TypeError('invalid reviewState');
  engine.edges.push(value);
  return clone(value);
}

export function recordClaim(engine, claim) {
  required(claim?.claimId, 'claimId');
  const value = { ...clone(claim), reviewState: claim.reviewState || 'UNVERIFIED', evidenceEdgeIds: [...(claim.evidenceEdgeIds || [])] };
  engine.claims.set(value.claimId, value);
  return clone(value);
}

export function recordKnowledgeGap(engine, gap) {
  required(gap?.gapId, 'gapId');
  const value = { ...clone(gap), status: gap.status || 'OPEN', evidenceNeeded: [...(gap.evidenceNeeded || [])] };
  engine.gaps.set(value.gapId, value);
  return clone(value);
}

export function assertImmutableSource(before, after) {
  for (const field of immutableFields) {
    if (before?.[field] === undefined || before?.[field] === null) continue;
    if (JSON.stringify(before[field]) !== JSON.stringify(after?.[field])) throw new Error(`V7 cannot mutate immutable field: ${field}`);
  }
  return true;
}

export function createAiSynthesis(engine, synthesis) {
  return addNode(engine, { ...synthesis, trustType: 'AI_SYNTHESIS', reviewState: 'UNVERIFIED' });
}

export function canAuthoritativelyUse(value) { return value?.reviewState === 'SCHOLAR_REVIEWED' || value?.reviewState === 'HUMAN_REVIEWED'; }

export function v7Health(engine) { return { stageId: engine.stageId, status: engine.status, nodes: engine.nodes.size, edges: engine.edges.length, claims: engine.claims.size, gaps: engine.gaps.size, traces: engine.traces.length }; }
