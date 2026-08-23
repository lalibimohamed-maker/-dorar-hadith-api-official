const REQUIRED_NODE_FIELDS = ['id', 'kind', 'sourceId', 'citation'];
const ALLOWED_NODE_KINDS = new Set(['ayah', 'hadith', 'tafsir', 'asbab_al_nuzul', 'sirah']);
const ALLOWED_RELATIONS = new Set(['relates_to', 'explains', 'contextualizes', 'supports', 'cited_in']);

function validateNode(node = {}) {
  const errors = [];
  for (const field of REQUIRED_NODE_FIELDS) {
    if (node[field] == null || node[field] === '') errors.push(`node:missing:${field}`);
  }
  if (node.kind && !ALLOWED_NODE_KINDS.has(node.kind)) errors.push(`node:unknown-kind:${node.kind}`);
  if (node.generated === true) errors.push('node:generated-content-not-allowed');
  return { valid: errors.length === 0, errors };
}

export function validateQuranHadithContextNode(node = {}) {
  return validateNode(node);
}

export function createQuranHadithContextRelation(relation = {}) {
  const errors = [];
  if (!relation.id || !relation.from || !relation.to) errors.push('relation:missing-identity');
  if (!ALLOWED_RELATIONS.has(relation.type)) errors.push(`relation:unknown-type:${relation.type}`);
  if (!relation.sourceId || !relation.citation) errors.push('relation:missing-provenance');
  if (relation.generated === true) errors.push('relation:generated-content-not-allowed');
  if (errors.length) throw new TypeError(`Invalid Quran/Hadith relation: ${errors.join(',')}`);
  return structuredClone(relation);
}

export function buildQuranHadithContextNetwork(nodes = [], relations = []) {
  const registry = new Map();
  for (const node of nodes) {
    const result = validateNode(node);
    if (!result.valid) throw new TypeError(`Invalid context node: ${result.errors.join(',')}`);
    if (registry.has(node.id)) throw new TypeError(`Duplicate context node: ${node.id}`);
    registry.set(node.id, structuredClone(node));
  }
  const edges = relations.map(createQuranHadithContextRelation);
  for (const edge of edges) {
    if (!registry.has(edge.from) || !registry.has(edge.to)) {
      throw new TypeError(`Unknown context node in relation: ${edge.id}`);
    }
  }
  return { nodes: [...registry.values()], edges };
}

export function findContextRelations(graph, nodeId) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw new TypeError('Invalid context graph');
  return graph.edges.filter(edge => edge.from === nodeId || edge.to === nodeId).map(structuredClone);
}
