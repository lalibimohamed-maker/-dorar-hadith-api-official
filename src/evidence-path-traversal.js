export function validateEvidenceGraph(graph = {}) {
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw new TypeError('Invalid evidence graph');
  const ids = new Set(graph.nodes.map(node => node.id));
  if (ids.size !== graph.nodes.length) throw new TypeError('Duplicate graph node');
  for (const edge of graph.edges) {
    if (!edge.id || !edge.from || !edge.to || !edge.type) throw new TypeError('Invalid graph edge');
    if (!ids.has(edge.from) || !ids.has(edge.to)) throw new TypeError(`Unknown graph endpoint: ${edge.id}`);
    if (!edge.sourceId || !edge.citation) throw new TypeError(`Unprovenanced graph edge: ${edge.id}`);
  }
  return true;
}

export function findEvidencePaths(graph, startId, targetId, options = {}) {
  validateEvidenceGraph(graph);
  const maxDepth = Number.isInteger(options.maxDepth) ? options.maxDepth : 6;
  if (maxDepth < 0) throw new RangeError('maxDepth must be non-negative');
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  if (!nodes.has(startId) || !nodes.has(targetId)) return [];
  if (startId === targetId) return [[nodes.get(startId)]];
  const adjacency = new Map();
  for (const edge of graph.edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from).push(edge);
  }
  const queue = [{ id: startId, path: [nodes.get(startId)], edges: [] }];
  const results = [];
  const seen = new Set([`${startId}|0`]);
  while (queue.length) {
    const current = queue.shift();
    if (current.edges.length >= maxDepth) continue;
    for (const edge of adjacency.get(current.id) || []) {
      if (current.path.some(node => node.id === edge.to)) continue;
      const nextPath = [...current.path, nodes.get(edge.to)];
      const nextEdges = [...current.edges, edge];
      if (edge.to === targetId) results.push({ nodes: nextPath, edges: nextEdges });
      else {
        const key = `${edge.to}|${nextEdges.length}`;
        if (!seen.has(key)) { seen.add(key); queue.push({ id: edge.to, path: nextPath, edges: nextEdges }); }
      }
    }
  }
  return results;
}

export function explainEvidencePath(path) {
  if (!path || !Array.isArray(path.nodes) || !Array.isArray(path.edges)) throw new TypeError('Invalid evidence path');
  return path.edges.map((edge, index) => ({
    from: path.nodes[index].id,
    relation: edge.type,
    to: path.nodes[index + 1].id,
    sourceId: edge.sourceId,
    citation: edge.citation
  }));
}
