import { validateGraph, validateNode, validateEdge, assertSourceBackedEvidence, isTrustedEvidence } from './deen-graph-contract.js';

export function createGraph() {
  return { nodes: new Map(), edges: new Map(), adjacency: new Map() };
}

export function addNode(graph, node) {
  const result = validateNode(node);
  if (!result.valid) throw new TypeError(`Invalid node: ${result.errors.join(',')}`);
  if (graph.nodes.has(node.id)) throw new TypeError(`Duplicate node: ${node.id}`);
  graph.nodes.set(node.id, structuredClone(node));
  graph.adjacency.set(node.id, []);
  return node.id;
}

export function addEdge(graph, edge) {
  const result = validateEdge(edge);
  if (!result.valid) throw new TypeError(`Invalid edge: ${result.errors.join(',')}`);
  if (!graph.nodes.has(edge.from) || !graph.nodes.has(edge.to)) throw new TypeError('Edge endpoints must exist');
  if (graph.edges.has(edge.id)) throw new TypeError(`Duplicate edge: ${edge.id}`);
  graph.edges.set(edge.id, structuredClone(edge));
  graph.adjacency.get(edge.from).push(edge.id);
  return edge.id;
}

export function addEvidence(graph, { nodeId, evidence }) {
  if (!graph.nodes.has(nodeId)) throw new TypeError(`Unknown node: ${nodeId}`);
  assertSourceBackedEvidence(evidence);
  const node = graph.nodes.get(nodeId);
  node.evidence = [...(node.evidence || []), structuredClone(evidence)];
  return node;
}

export function getTrustedNodes(graph) {
  return [...graph.nodes.values()].filter((node) =>
    (node.evidence || []).some(isTrustedEvidence)
  );
}

export function neighbors(graph, nodeId, { edgeTypes = null } = {}) {
  if (!graph.nodes.has(nodeId)) return [];
  const allowed = edgeTypes ? new Set(edgeTypes) : null;
  return graph.adjacency.get(nodeId)
    .map((id) => graph.edges.get(id))
    .filter((edge) => !allowed || allowed.has(edge.type))
    .map((edge) => graph.nodes.get(edge.to))
    .filter(Boolean);
}

export function snapshotGraph(graph) {
  return {
    nodes: [...graph.nodes.values()].map(structuredClone),
    edges: [...graph.edges.values()].map(structuredClone)
  };
}

export function validateRuntimeGraph(graph) {
  return validateGraph(snapshotGraph(graph));
}
