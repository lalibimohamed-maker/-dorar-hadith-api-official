import { createV7GlobalKnowledgeEvidenceGraphEngine, addNode, addEvidenceEdge, recordKnowledgeGap, createAiSynthesis } from './rechercher-v7-global-knowledge-evidence-graph-engine.js';

export const WORLD_SOURCE_TYPES = Object.freeze([
  'NATIONAL_LIBRARY','UNIVERSITY_LIBRARY','ARCHIVE','MUSEUM','MANUSCRIPT_REPOSITORY','DIGITAL_HUMANITIES','ISLAMIC_CORPUS','BOOK_PDF','ARTICLE','AUDIO','VIDEO','MAP','OCR_HTR','STRUCTURED_DATA','API','IIIF','KNOWLEDGE_GRAPH','WEB_SOURCE'
]);
export const MULTILINGUAL_RELATIONS = Object.freeze(['EXACT','CLOSE','HISTORICAL','SCHOOL_SPECIFIC','TRANSLATION_VARIANT','NO_EXACT_EQUIVALENT']);
export const RESEARCH_STATES = Object.freeze(['DISCOVER','SYNTHESIS','VERIFICATION']);

export function createGlobalKnowledgeIntelligenceMesh() {
  return {
    status: 'FOUNDATION_IMPLEMENTED_EXTENSION_POINT',
    sources: new Map(), works: new Map(), concepts: new Map(), terminology: [],
    gaps: new Map(), research: new Map(), graph: createV7GlobalKnowledgeEvidenceGraphEngine(), traces: []
  };
}

export function registerWorldSource(mesh, source) {
  if (!source?.sourceId) throw new TypeError('sourceId is required');
  if (!WORLD_SOURCE_TYPES.includes(source.sourceType)) throw new TypeError('unsupported world source type');
  if (!source.provenance) throw new Error('provenance evidence is required');
  if (!source.rightsState) throw new Error('rights state is required');
  mesh.sources.set(source.sourceId, structuredClone(source));
  return structuredClone(source);
}

export function registerWork(mesh, work) {
  if (!work?.workId) throw new TypeError('workId is required');
  const value = structuredClone(work);
  value.editions = [...(value.editions || [])];
  mesh.works.set(value.workId, value);
  return structuredClone(value);
}

export function relateMultilingualConcept(mesh, relation) {
  if (!relation?.relation) throw new TypeError('relation is required');
  if (!MULTILINGUAL_RELATIONS.includes(relation.relation)) throw new TypeError('invalid multilingual relation');
  const value = structuredClone(relation);
  mesh.terminology.push(value);
  return value;
}

export function detectKnowledgeGap(mesh, gap) {
  const value = recordKnowledgeGap(mesh.graph, gap);
  mesh.gaps.set(value.gapId, value);
  return value;
}

export function startResearch(mesh, research) {
  if (!research?.researchId) throw new TypeError('researchId is required');
  const value = { ...structuredClone(research), state: 'DISCOVER', sources: [], evidenceEdgeIds: [] };
  mesh.research.set(value.researchId, value);
  return structuredClone(value);
}

export function attachDiscovery(mesh, researchId, sourceId) {
  const research = mesh.research.get(researchId);
  if (!research) throw new Error('research not found');
  if (!mesh.sources.has(sourceId)) throw new Error('source not registered');
  research.sources.push(sourceId);
  research.state = 'SYNTHESIS';
  return structuredClone(research);
}

export function synthesizeResearch(mesh, researchId, synthesis) {
  const research = mesh.research.get(researchId);
  if (!research) throw new Error('research not found');
  const node = createAiSynthesis(mesh.graph, { nodeId: synthesis.nodeId, content: synthesis.content, sourceIds: [...research.sources] });
  addNode(mesh.graph, { nodeId: `research:${researchId}`, type: 'RESEARCH_OUTPUT', reviewState: 'UNVERIFIED' });
  research.synthesisNodeId = node.nodeId;
  research.state = 'VERIFICATION';
  return structuredClone(research);
}

export function verifyResearch(mesh, researchId, evidence) {
  const research = mesh.research.get(researchId);
  if (!research) throw new Error('research not found');
  if (research.state !== 'VERIFICATION') throw new Error('research must reach verification');
  const target = `research:${researchId}`;
  const edge = addEvidenceEdge(mesh.graph, { edgeId: `evidence:${researchId}`, from: evidence.sourceNodeId, to: target, relation: evidence.relation || 'SUPPORTS', provenance: evidence.provenance, confidence: evidence.confidence, reviewState: evidence.reviewState || 'UNVERIFIED' });
  research.evidenceEdgeIds.push(edge.edgeId);
  return structuredClone(research);
}
