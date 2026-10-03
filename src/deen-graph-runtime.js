import { validateGraph, validateNode, validateEdge, validateTrustedPath, assertSourceBackedEvidence, isTrustedEvidence } from './deen-graph-contract.js';

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

export function neighbors(graph, nodeId, { edgeTypes = null, direction = "out", trustedOnly = false } = {}) {
  if (!graph.nodes.has(nodeId)) return [];
  const allowed = edgeTypes ? new Set(edgeTypes) : null;
  const matches = [];
  for (const edge of graph.edges.values()) {
    const outgoing = edge.from === nodeId;
    const incoming = edge.to === nodeId;
    if ((direction === "out" && !outgoing) || (direction === "in" && !incoming) || (direction === "both" && !outgoing && !incoming)) continue;
    if (allowed && !allowed.has(edge.type)) continue;
    if (trustedOnly && (!isTrustedEvidence(edge.provenance) || !isTrustedEvidence(graph.nodes.get(edge.from)?.provenance) || !isTrustedEvidence(graph.nodes.get(edge.to)?.provenance))) continue;
    const targetId = outgoing ? edge.to : edge.from;
    const node = graph.nodes.get(targetId);
    if (node) matches.push(node);
  }
  return matches;
}

export function snapshotGraph(graph) {
  return {
    nodes: [...graph.nodes.values()].map((node) => structuredClone(node)),
    edges: [...graph.edges.values()].map((edge) => structuredClone(edge))
  };
}

export function validateRuntimeGraph(graph, { trustedOnly = false } = {}) {
  const snapshot = snapshotGraph(graph);
  return trustedOnly ? validateTrustedPath(snapshot) : validateGraph(snapshot);
}
