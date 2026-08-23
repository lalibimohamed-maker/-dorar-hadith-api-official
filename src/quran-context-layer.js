const NODE_KINDS = new Set(['ayah', 'tafsir', 'asbab_al_nuzul', 'sirah']);
const RELATION_TYPES = new Set(['explains', 'has_revelation_context', 'has_sirah_context', 'supports', 'cited_in']);
const REQUIRED = ['id', 'kind', 'sourceId', 'citation'];

function validateNode(node = {}) {
  const errors = REQUIRED.filter(field => node[field] == null || node[field] === '').map(field => `node:missing:${field}`);
  if (node.kind && !NODE_KINDS.has(node.kind)) errors.push(`node:unknown-kind:${node.kind}`);
  if (node.generated === true) errors.push('node:generated-content-not-allowed');
  return { valid: errors.length === 0, errors };
}

export function validateQuranContextNode(node = {}) { return validateNode(node); }

export function createQuranContextRelation(relation = {}) {
  const errors = [];
  if (!relation.id || !relation.from || !relation.to) errors.push('relation:missing-identity');
  if (!RELATION_TYPES.has(relation.type)) errors.push(`relation:unknown-type:${relation.type}`);
  if (!relation.sourceId || !relation.citation) errors.push('relation:missing-provenance');
  if (relation.generated === true) errors.push('relation:generated-content-not-allowed');
  if (errors.length) throw new TypeError(`Invalid Quran context relation: ${errors.join(',')}`);
  return structuredClone(relation);
}

export function buildQuranContextLayer(nodes = [], relations = []) {
  const registry = new Map();
  for (const node of nodes) {
    const result = validateNode(node);
    if (!result.valid) throw new TypeError(`Invalid Quran context node: ${result.errors.join(',')}`);
    if (registry.has(node.id)) throw new TypeError(`Duplicate Quran context node: ${node.id}`);
    registry.set(node.id, structuredClone(node));
  }
  const edges = relations.map(createQuranContextRelation);
  for (const edge of edges) {
    if (!registry.has(edge.from) || !registry.has(edge.to)) throw new TypeError(`Unknown Quran context node: ${edge.id}`);
  }
  return { nodes: [...registry.values()], edges };
}

export function getQuranContext(graph, ayahId) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw new TypeError('Invalid Quran context graph');
  return graph.edges.filter(edge => edge.from === ayahId || edge.to === ayahId).map(edge => ({ ...edge }));
}
