import { createNode, createEdge, buildMultilingualEvidenceGraph } from './rechercher-v7-evidence-graph-engine.js';
import { createClaim, createEvidence, createContradiction, buildResearchGraph } from './rechercher-claim-evidence-contradiction-engine.js';

export const V7_GRAPH_INTEGRATION_VERSION = '7.2.0';
export const PUBLIC_RIGHTS_STATE = 'ALLOWED';

function clone(value) { return structuredClone(value); }
function requireId(value, name) { if (typeof value !== 'string' || value.trim() === '') throw new Error(`${name} is required`); }
function requireSource(source) {
  requireId(source?.sourceId, 'sourceId');
  if (source.state !== 'VERIFIED_SOURCE') throw new Error('source must be a verified V6 source');
  if (!source.provenance) throw new Error('verified source provenance is required');
  if (!source.rightsEvidence) throw new Error('verified source rights evidence is required');
  return source;
}
export function sourceIsPublic(source) { return source?.state === 'VERIFIED_SOURCE' && source?.rightsState === PUBLIC_RIGHTS_STATE && source?.publishable === true; }

export function createRuntime({ sourceEngine = null, observability = null } = {}) {
  return { version: V7_GRAPH_INTEGRATION_VERSION, sourceEngine, observability, claims:new Map(), evidences:new Map(), contradictions:new Map(), nodes:new Map(), edges:new Map(), alignments:[], searchIndex:new Map(), traces:[] };
}
function recordTrace(runtime, type, payload = {}) {
  const event = { traceId:`rechercher-v7-graph-${runtime.traces.length + 1}`, type, at:new Date().toISOString(), ...clone(payload) };
  runtime.traces.push(event); if (runtime.observability?.record) runtime.observability.record(event); return event.traceId;
}
function getVerifiedSource(runtime, sourceId) { const source=runtime.sourceEngine?.sources?.get(sourceId); if (!source) throw new Error(`verified source not found: ${sourceId}`); return requireSource(source); }

export function addSourceNode(runtime, sourceId) {
  const source=getVerifiedSource(runtime, sourceId);
  const node=createNode({ nodeId:`source:${source.sourceId}`, kind:'SOURCE', label:source.label || source.title || source.sourceId, provenance:source.provenance, sourceIdentity:source.sourceIdentity || source.sourceId, contentHash:source.contentHash || null, originalPdf:source.originalPdf || null, canonicalQuranArabic:source.canonicalQuranArabic || null, metadata:{ rightsState:source.rightsState, publishable:sourceIsPublic(source), sourceUrl:source.sourceUrl || null } });
  runtime.nodes.set(node.nodeId,node); return node;
}
function indexSearch(runtime,node,source) {
  const terms=`${node.label || ''} ${node.kind || ''}`.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  for (const term of new Set(terms)) { if (!runtime.searchIndex.has(term)) runtime.searchIndex.set(term,new Set()); runtime.searchIndex.get(term).add(node.nodeId); }
  node.sourceId=source.sourceId;
}

export function ingestClaim(runtime,input={}) {
  const claim=createClaim(input); const source=getVerifiedSource(runtime,claim.provenance.sourceIds[0]);
  addSourceNode(runtime,source.sourceId);
  const node=createNode({ nodeId:`claim:${claim.claimId}`, kind:'CLAIM', label:claim.text, provenance:claim.provenance, sourceIdentity:claim.sourceIdentity || source.sourceIdentity || source.sourceId, metadata:{ status:claim.status, reviewState:claim.reviewState, publicEvidence:sourceIsPublic(source) } });
  const edge=createEdge({ edgeId:`source-attribution:${source.sourceId}:${claim.claimId}`, from:node.nodeId, to:`source:${source.sourceId}`, relation:'ATTRIBUTED_TO', provenance:claim.provenance, metadata:{ relationContext:'claim-source' } });
  runtime.claims.set(claim.claimId,claim); runtime.nodes.set(node.nodeId,node); runtime.edges.set(edge.edgeId,edge); indexSearch(runtime,node,source); recordTrace(runtime,'CLAIM_INGESTED',{claimId:claim.claimId,sourceId:source.sourceId}); return clone(claim);
}

export function ingestEvidence(runtime,input={}) {
  const evidence=createEvidence(input); const claim=runtime.claims.get(evidence.claimId); if (!claim) throw new Error(`claim not found: ${evidence.claimId}`);
  const source=getVerifiedSource(runtime,evidence.provenance.sourceIds[0]);
  const node=createNode({ nodeId:`evidence:${evidence.evidenceId}`, kind:'EVIDENCE', label:evidence.passageId || evidence.evidenceId, provenance:evidence.provenance, sourceIdentity:evidence.sourceIdentity || source.sourceIdentity || source.sourceId, metadata:{ strength:evidence.strength, reviewState:evidence.reviewState, publicEvidence:sourceIsPublic(source) } });
  const edge=createEdge({ edgeId:`evidence-for:${evidence.evidenceId}`, from:node.nodeId, to:`claim:${claim.claimId}`, relation:'SUPPORTS', provenance:evidence.provenance, metadata:{ strength:evidence.strength, passageId:evidence.passageId } });
  runtime.nodes.set(node.nodeId,node); runtime.edges.set(edge.edgeId,edge); runtime.evidences.set(evidence.evidenceId,evidence); indexSearch(runtime,node,source); recordTrace(runtime,'EVIDENCE_INGESTED',{evidenceId:evidence.evidenceId,claimId:claim.claimId,sourceId:source.sourceId}); return clone(evidence);
}

export function ingestContradiction(runtime,input={}) {
  const contradiction=createContradiction(input);
  if (!runtime.claims.has(contradiction.leftClaimId) || !runtime.claims.has(contradiction.rightClaimId)) throw new Error('contradiction references a missing claim');
  for (const claimId of [contradiction.leftClaimId,contradiction.rightClaimId]) getVerifiedSource(runtime,runtime.claims.get(claimId).provenance.sourceIds[0]);
  runtime.contradictions.set(contradiction.contradictionId,contradiction);
  const node=createNode({ nodeId:`contradiction:${contradiction.contradictionId}`, kind:'CONTRADICTION', label:contradiction.type, provenance:contradiction.provenance, metadata:{ confidence:contradiction.confidence, reviewState:contradiction.reviewState } });
  runtime.nodes.set(node.nodeId,node);
  for (const claimId of [contradiction.leftClaimId,contradiction.rightClaimId]) { const edge=createEdge({ edgeId:`contradiction:${contradiction.contradictionId}:${claimId}`, from:node.nodeId, to:`claim:${claimId}`, relation:'CONTRADICTS', provenance:contradiction.provenance, metadata:{ contradictionType:contradiction.type } }); runtime.edges.set(edge.edgeId,edge); }
  recordTrace(runtime,'CONTRADICTION_INGESTED',{contradictionId:contradiction.contradictionId}); return clone(contradiction);
}

export function alignLanguages(runtime,input={}) {
  const graph=buildMultilingualEvidenceGraph({ nodes:[...runtime.nodes.values()], alignments:[input] }); runtime.alignments.push(clone(input)); for (const edge of graph.edges) runtime.edges.set(edge.edgeId,edge); recordTrace(runtime,'MULTILINGUAL_EVIDENCE_ALIGNED',{alignmentId:input.alignmentId,matchType:input.matchType}); return graph.edges[0];
}

export function buildIntegratedResearchGraph(runtime) {
  const base=buildResearchGraph({ claims:[...runtime.claims.values()], evidences:[...runtime.evidences.values()], contradictions:[...runtime.contradictions.values()] });
  return Object.freeze({ ...base, graphNodes:[...runtime.nodes.values()], graphEdges:[...runtime.edges.values()], traceCount:runtime.traces.length });
}

export function search(runtime,query,{limit=20,publicOnly=true}={}) {
  requireId(query,'query'); const terms=query.toLocaleLowerCase().split(/\s+/).filter(Boolean); const candidates=new Map();
  for (const term of terms) for (const nodeId of runtime.searchIndex.get(term) || []) candidates.set(nodeId,(candidates.get(nodeId)||0)+1);
  const ranked=[...candidates.entries()].map(([nodeId,score])=>{const node=runtime.nodes.get(nodeId);const source=node?.sourceId ? runtime.sourceEngine?.sources?.get(node.sourceId) : null;return {node,source,score};})
    .filter(item=>item.node && item.source?.state==='VERIFIED_SOURCE' && (!publicOnly || sourceIsPublic(item.source)))
    .sort((a,b)=>b.score-a.score || a.node.nodeId.localeCompare(b.node.nodeId)).slice(0,limit)
    .map(item=>({nodeId:item.node.nodeId,kind:item.node.kind,label:item.node.label,sourceId:item.source.sourceId,rightsState:item.source.rightsState,score:item.score}));
  recordTrace(runtime,'GRAPH_SEARCH',{query,resultCount:ranked.length,publicOnly}); return ranked;
}

export function health(runtime) {
  const publicSources=runtime.sourceEngine ? [...runtime.sourceEngine.sources.values()].filter(sourceIsPublic).length : 0;
  return { version:runtime.version, claims:runtime.claims.size, evidences:runtime.evidences.size, contradictions:runtime.contradictions.size, nodes:runtime.nodes.size, edges:runtime.edges.size, alignments:runtime.alignments.length, publicSources, indexedTerms:runtime.searchIndex.size, traces:runtime.traces.length };
}
