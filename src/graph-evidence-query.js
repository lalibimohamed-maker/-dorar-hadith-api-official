import { validateGraph as validateGraphContract, isTrustedEvidence } from "./deen-graph-contract.js";

function validateGraph(graph) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw new TypeError("Invalid graph");
  const result = validateGraphContract(graph);
  if (!result.valid) throw new TypeError(result.errors.join("; "));
  return new Set(graph.nodes.map((node) => node.id));
}

function adjacency(graph, direction = "out", requireTrusted = false) {
  const map = new Map();
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  for (const edge of graph.edges) {
    if (requireTrusted && (
      !isTrustedEvidence(edge.provenance) ||
      !isTrustedEvidence(nodes.get(edge.from)?.provenance) ||
      !isTrustedEvidence(nodes.get(edge.to)?.provenance)
    )) continue;

    const add = (from, to, traversalDirection) => {
      if (!map.has(from)) map.set(from, []);
      map.get(from).push({ edge, to, traversalDirection });
    };

    if (direction === "in") add(edge.to, edge.from, "reverse");
    else if (direction === "both") {
      add(edge.from, edge.to, "forward");
      add(edge.to, edge.from, "reverse");
    } else add(edge.from, edge.to, "forward");
  }
  return map;
}

export function queryEvidencePaths(graph, startId, targetId, options = {}) {
  const ids = validateGraph(graph);
  if (!ids.has(startId) || !ids.has(targetId)) return [];
  if (startId === targetId) return [{ nodes: [startId], edges: [], provenance: [] }];

  const maxDepth = Number.isInteger(options.maxDepth) && options.maxDepth > 0 ? options.maxDepth : 6;
  const maxPaths = Number.isInteger(options.maxPaths) && options.maxPaths > 0 ? options.maxPaths : 20;
  const allowedTypes = options.allowedKinds ? new Set(options.allowedKinds) : null;
  const direction = ["out", "in", "both"].includes(options.direction) ? options.direction : "out";
  const requireTrusted = options.requireTrusted === true;
  const byId = new Map(graph.nodes.map(node => [node.id, node]));
  const next = adjacency(graph, direction, requireTrusted);
  const results = [];
  const queue = [{ node: startId, nodes: [startId], edges: [], provenance: [], seen: new Set([startId]) }];

  while (queue.length && results.length < maxPaths) {
    const current = queue.shift();
    if (current.edges.length >= maxDepth) continue;
    for (const transition of next.get(current.node) || []) {
      const destination = byId.get(transition.to);
      if (!destination || (allowedTypes && !allowedTypes.has(destination.type)) || current.seen.has(transition.to)) continue;
      const pathEdge = {
        ...transition.edge,
        traversalDirection: transition.traversalDirection
      };
      const path = {
        nodes: [...current.nodes, transition.to],
        edges: [...current.edges, pathEdge],
        provenance: [
          ...current.provenance,
          {
            sourceId: transition.edge.provenance.sourceId,
            citation: transition.edge.provenance.citation,
            verificationState: transition.edge.provenance.verificationState || null
          }
        ]
      };
      if (transition.to === targetId) results.push(path);
      else queue.push({
        node: transition.to,
        nodes: path.nodes,
        edges: path.edges,
        provenance: path.provenance,
        seen: new Set([...current.seen, transition.to])
      });
    }
  }
  return results;
}

export function rankEvidencePaths(paths = []) {
  return [...paths].sort((a, b) => a.edges.length - b.edges.length || b.provenance.length - a.provenance.length);
}
