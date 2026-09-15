const GRAPH_FAMILIES = Object.freeze([
  'ATTRIBUTION',
  'SCHOLAR',
  'HADITH_CHAIN',
  'FIQH_DISAGREEMENT',
  'MULTILINGUAL_EVIDENCE',
]);

const REVIEW_STATES = Object.freeze([
  'UNREVIEWED',
  'REVIEW_REQUIRED',
  'SCHOLAR_REVIEWED',
  'VERIFIED',
]);

const RELATION_TYPES = Object.freeze([
  'AUTHORED',
  'ATTRIBUTED_TO',
  'TRANSMITTED_BY',
  'STUDIED_BY',
  'TAUGHT_BY',
  'NARRATED_BY',
  'RECEIVED_FROM',
  'SUPPORTS',
  'CONTRADICTS',
  'EXPLAINS',
  'DIFFERS_FROM',
  'SAME_CONCEPT',
  'CLOSE_CONCEPT',
  'TRANSLATION_VARIANT',
  'NO_EXACT_EQUIVALENT',
]);

const MATCH_TYPES = Object.freeze([
  'EXACT',
  'CLOSE',
  'HISTORICAL',
  'SCHOOL_SPECIFIC',
  'TRANSLATION_VARIANT',
  'NO_EXACT_EQUIVALENT',
]);

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${field} is required`);
  return value;
}

function requireProvenance(value, field = 'provenance') {
  if (!value || !Array.isArray(value.sourceIds) || value.sourceIds.length === 0) {
    throw new Error(`${field} is required`);
  }
  return structuredClone(value);
}

function assertImmutableIdentity(input) {
  for (const field of ['sourceIdentity', 'contentHash', 'originalPdf', 'canonicalQuranArabic']) {
    if (input[field] === undefined) continue;
    if (field === 'originalPdf' && input[field] !== null && typeof input[field] !== 'string') {
      throw new Error('originalPdf identity must remain an immutable string or null');
    }
  }
}

function createNode(input = {}) {
  requiredString(input.nodeId, 'nodeId');
  requiredString(input.kind, 'kind');
  assertImmutableIdentity(input);
  return Object.freeze({
    nodeId: input.nodeId,
    kind: input.kind,
    label: input.label || input.nodeId,
    metadata: structuredClone(input.metadata || {}),
    provenance: requireProvenance(input.provenance),
    reviewState: input.reviewState || 'UNREVIEWED',
    sourceIdentity: input.sourceIdentity || null,
    sourceId: input.sourceId || null,
    contentHash: input.contentHash || null,
    originalPdf: input.originalPdf || null,
    canonicalQuranArabic: input.canonicalQuranArabic || null,
  });
}

function createEdge(input = {}) {
  requiredString(input.edgeId, 'edgeId');
  requiredString(input.from, 'from');
  requiredString(input.to, 'to');
  requiredString(input.relation, 'relation');
  if (!RELATION_TYPES.includes(input.relation)) throw new Error(`unsupported relation: ${input.relation}`);
  return Object.freeze({
    edgeId: input.edgeId,
    from: input.from,
    to: input.to,
    relation: input.relation,
    confidence: Number.isFinite(input.confidence) ? input.confidence : 0,
    provenance: requireProvenance(input.provenance),
    reviewState: input.reviewState || 'UNREVIEWED',
    metadata: structuredClone(input.metadata || {}),
  });
}

function assertEndpoints(nodes, edges) {
  const ids = new Set(nodes.map((node) => node.nodeId));
  for (const edge of edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) throw new Error(`missing graph endpoint for ${edge.edgeId}`);
  }
}

function buildGraph({ family, nodes = [], edges = [] } = {}) {
  if (!GRAPH_FAMILIES.includes(family)) throw new Error(`unsupported graph family: ${family}`);
  assertEndpoints(nodes, edges);
  return Object.freeze({ family, nodes: [...nodes], edges: [...edges] });
}

function verifyGraph(graph, review = {}) {
  if (!graph || !GRAPH_FAMILIES.includes(graph.family)) throw new Error('valid graph family is required');
  if (review.reviewState !== 'SCHOLAR_REVIEWED') throw new Error('scholarly review is required before graph verification');
  return Object.freeze({ ...graph, reviewState: 'VERIFIED' });
}

function createAttributionGraph(input = {}) {
  return buildGraph({ family: 'ATTRIBUTION', nodes: input.nodes || [], edges: input.edges || [] });
}

function createScholarGraph(input = {}) {
  return buildGraph({ family: 'SCHOLAR', nodes: input.nodes || [], edges: input.edges || [] });
}

function createHadithChainGraph(input = {}) {
  const graph = buildGraph({ family: 'HADITH_CHAIN', nodes: input.nodes || [], edges: input.edges || [] });
  for (const edge of graph.edges) {
    if (!['NARRATED_BY', 'RECEIVED_FROM', 'TRANSMITTED_BY', 'SUPPORTS', 'CONTRADICTS'].includes(edge.relation)) {
      throw new Error(`invalid hadith-chain relation: ${edge.relation}`);
    }
  }
  return graph;
}

function createFiqhDisagreementGraph(input = {}) {
  const graph = buildGraph({ family: 'FIQH_DISAGREEMENT', nodes: input.nodes || [], edges: input.edges || [] });
  for (const edge of graph.edges) {
    if (!['DIFFERS_FROM', 'SUPPORTS', 'CONTRADICTS', 'EXPLAINS'].includes(edge.relation)) {
      throw new Error(`invalid fiqh-disagreement relation: ${edge.relation}`);
    }
  }
  return graph;
}

function alignEvidenceAcrossLanguages(input = {}) {
  requiredString(input.alignmentId, 'alignmentId');
  requiredString(input.sourceEvidenceId, 'sourceEvidenceId');
  requiredString(input.targetEvidenceId, 'targetEvidenceId');
  if (!MATCH_TYPES.includes(input.matchType)) throw new Error(`unsupported match type: ${input.matchType}`);
  requireProvenance(input.provenance);
  return Object.freeze({
    alignmentId: input.alignmentId,
    sourceEvidenceId: input.sourceEvidenceId,
    targetEvidenceId: input.targetEvidenceId,
    sourceLanguage: requiredString(input.sourceLanguage, 'sourceLanguage'),
    targetLanguage: requiredString(input.targetLanguage, 'targetLanguage'),
    matchType: input.matchType,
    confidence: Number.isFinite(input.confidence) ? input.confidence : 0,
    terminology: structuredClone(input.terminology || null),
    provenance: structuredClone(input.provenance),
    reviewState: input.reviewState || 'REVIEW_REQUIRED',
  });
}

function buildMultilingualEvidenceGraph(input = {}) {
  const alignments = (input.alignments || []).map(alignEvidenceAcrossLanguages);
  const nodes = input.nodes || [];
  const nodeIds = new Set(nodes.map((node) => node.nodeId));
  for (const alignment of alignments) {
    if (!nodeIds.has(alignment.sourceEvidenceId) || !nodeIds.has(alignment.targetEvidenceId)) {
      throw new Error(`missing multilingual evidence endpoint for ${alignment.alignmentId}`);
    }
  }
  return buildGraph({
    family: 'MULTILINGUAL_EVIDENCE',
    nodes,
    edges: alignments.map((alignment) => ({
      edgeId: alignment.alignmentId,
      from: alignment.sourceEvidenceId,
      to: alignment.targetEvidenceId,
      relation: alignment.matchType === 'EXACT' ? 'SAME_CONCEPT' : alignment.matchType === 'NO_EXACT_EQUIVALENT' ? 'NO_EXACT_EQUIVALENT' : 'TRANSLATION_VARIANT',
      confidence: alignment.confidence,
      provenance: alignment.provenance,
      reviewState: alignment.reviewState,
      metadata: {
        sourceLanguage: alignment.sourceLanguage,
        targetLanguage: alignment.targetLanguage,
        matchType: alignment.matchType,
        terminology: alignment.terminology,
      },
    })),
  });
}

function createV7EvidenceGraphEngine() {
  return Object.freeze({
    version: '7.1.0',
    graphFamilies: [...GRAPH_FAMILIES],
    relationTypes: [...RELATION_TYPES],
    matchTypes: [...MATCH_TYPES],
    createNode,
    createEdge,
    createAttributionGraph,
    createScholarGraph,
    createHadithChainGraph,
    createFiqhDisagreementGraph,
    alignEvidenceAcrossLanguages,
    buildMultilingualEvidenceGraph,
    verifyGraph,
  });
}

export {
  GRAPH_FAMILIES,
  REVIEW_STATES,
  RELATION_TYPES,
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
  createV7EvidenceGraphEngine,
};
