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
    provenance: requireProvenance(input.provenance),
    metadata: structuredClone(input.metadata || {}),
  });
}

function buildGraph({ family, nodes = [], edges = [] } = {}) {
  if (!GRAPH_FAMILIES.includes(family)) throw new Error(`unsupported graph family: ${family}`);
  const nodeIds = new Set(nodes.map(node => node.nodeId));
  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) throw new Error('graph edge references a missing endpoint');
  }
  return Object.freeze({ family, nodes: nodes.map(structuredClone), edges: edges.map(structuredClone) });
}

function verifyGraph(graph, reviewState = 'SCHOLAR_REVIEWED') {
  if (reviewState !== 'SCHOLAR_REVIEWED' && reviewState !== 'VERIFIED') {
    throw new Error('scholarly review is required for graph verification');
  }
  return Object.freeze({ ...structuredClone(graph), reviewState });
}

function createAttributionGraph(nodes = [], edges = []) {
  return buildGraph({ family: 'ATTRIBUTION', nodes, edges });
}

function createScholarGraph(nodes = [], edges = []) {
  return buildGraph({ family: 'SCHOLAR', nodes, edges });
}

function createHadithChainGraph(nodes = [], edges = []) {
  const allowed = new Set(['NARRATED_BY', 'RECEIVED_FROM', 'TRANSMITTED_BY', 'SUPPORTS', 'CONTRADICTS']);
  for (const edge of edges) {
    if (!allowed.has(edge.relation)) throw new Error(`unsupported hadith chain relation: ${edge.relation}`);
  }
  return buildGraph({ family: 'HADITH_CHAIN', nodes, edges });
}

function createFiqhDisagreementGraph(nodes = [], edges = []) {
  const allowed = new Set(['DIFFERS_FROM', 'SUPPORTS', 'CONTRADICTS', 'EXPLAINS']);
  for (const edge of edges) {
    if (!allowed.has(edge.relation)) throw new Error(`unsupported fiqh disagreement relation: ${edge.relation}`);
  }
  return buildGraph({ family: 'FIQH_DISAGREEMENT', nodes, edges });
}

function alignEvidenceAcrossLanguages(input = {}) {
  requiredString(input.alignmentId, 'alignmentId');
  requiredString(input.sourceEvidenceId, 'sourceEvidenceId');
  requiredString(input.targetEvidenceId, 'targetEvidenceId');
  requiredString(input.sourceLanguage, 'sourceLanguage');
  requiredString(input.targetLanguage, 'targetLanguage');
  if (!MATCH_TYPES.includes(input.matchType)) throw new Error(`unsupported match type: ${input.matchType}`);
  return Object.freeze({
    alignmentId: input.alignmentId,
    sourceEvidenceId: input.sourceEvidenceId,
    targetEvidenceId: input.targetEvidenceId,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    matchType: input.matchType,
    confidence: input.confidence ?? null,
    provenance: requireProvenance(input.provenance),
  });
}

function buildMultilingualEvidenceGraph({ nodes = [], alignments = [] } = {}) {
  const nodeIds = new Set(nodes.map(node => node.nodeId));
  const edges = alignments.map(alignment => {
    if (!nodeIds.has(alignment.sourceEvidenceId) || !nodeIds.has(alignment.targetEvidenceId)) {
      throw new Error('multilingual alignment references a missing evidence endpoint');
    }
    const relation = alignment.matchType === 'EXACT'
      ? 'SAME_CONCEPT'
      : alignment.matchType === 'NO_EXACT_EQUIVALENT'
        ? 'NO_EXACT_EQUIVALENT'
        : 'TRANSLATION_VARIANT';
    return createEdge({
      edgeId: `alignment:${alignment.alignmentId}`,
      from: alignment.sourceEvidenceId,
      to: alignment.targetEvidenceId,
      relation,
      provenance: alignment.provenance,
      metadata: {
        sourceLanguage: alignment.sourceLanguage,
        targetLanguage: alignment.targetLanguage,
        matchType: alignment.matchType,
        confidence: alignment.confidence,
      },
    });
  });
  return buildGraph({ family: 'MULTILINGUAL_EVIDENCE', nodes, edges });
}

function createV7EvidenceGraphEngine() {
  return Object.freeze({ version: '7.1.0', status: 'FOUNDATION_IMPLEMENTED_EXTENSION_POINT' });
}

export {
  GRAPH_FAMILIES,
  REVIEW_STATES,
  RELATION_TYPES,
  MATCH_TYPES,
  createNode,
  createEdge,
  buildGraph,
  verifyGraph,
  createAttributionGraph,
  createScholarGraph,
  createHadithChainGraph,
  createFiqhDisagreementGraph,
  alignEvidenceAcrossLanguages,
  buildMultilingualEvidenceGraph,
  createV7EvidenceGraphEngine,
};
