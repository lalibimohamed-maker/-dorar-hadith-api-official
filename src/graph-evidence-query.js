const NODE_KINDS = new Set(['ayah', 'hadith', 'tafsir', 'asbab_al_nuzul', 'sirah', 'sharh', 'rijal', 'fatwa', 'fiqh', 'aqidah', 'other']);

function validateGraph(graph) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw new TypeError('Invalid graph');
  const ids = new Set();
  for (const node of graph.nodes) {
    if (!node.id || ids.has(node.id)) throw new TypeError(`Invalid or duplicate node: ${node.id}`);
    if (node.kind && !NODE_KINDS.has(node.kind)) throw new TypeError(`Unknown node kind: ${node.kind}`);
    ids.add(node.id);
  }
  for (const edge of graph.edges) {
    if (!edge.id || !edge.from || !edge.to || !ids.has(edge.from) || !ids.has(edge.to)) throw new TypeError(`Invalid graph edge: ${edge.id}`);
    if (!edge.sourceId || !edge.citation) throw new TypeError(`Unprovenanced graph edge: ${edge.id}`);
  }
  return ids;
}

function adjacency(graph) {
  const map = new Map();
  for (const edge of graph.edges) {
    if (!map.has(edge.from)) map.set(edge.from, []);
    map.get(edge.from).push(edge);
  }
  return map;
}

export function queryEvidencePaths(graph, startId, targetId, options = {}) {
  const ids = validateGraph(graph);
  if (!ids.has(startId) || !ids.has(targetId)) return [];
  if (startId === targetId) return [{ nodes: [startId], edges: [], provenance: [] }];
  const maxDepth = Number.isInteger(options.maxDepth) && options.maxDepth > 0 ? options.maxDepth : 6;
  const maxPaths = Number.isInteger(options.maxPaths) && options.maxPaths > 0 ? options.maxPaths : 20;
  const allowedKinds = options.allowedKinds ? new Set(options.allowedKinds) : null;
  const byId = new Map(graph.nodes.map(node => [node.id, node]));
  const next = adjacency(graph);
  const results = [];
  const queue = [{ node: startId, nodes: [startId], edges: [], provenance: [], seen: new Set([startId]) }];

  while (queue.length && results.length < maxPaths) {
    const current = queue.shift();
    if (current.edges.length >= maxDepth) continue;
    for (const edge of next.get(current.node) || []) {
      const destination = byId.get(edge.to);
      if (!destination || (allowedKinds && !allowedKinds.has(destination.kind)) || current.seen.has(edge.to)) continue;
      const path = {
        nodes: [...current.nodes, edge.to],
        edges: [...current.edges, { ...edge }],
        provenance: [...current.provenance, { sourceId: edge.sourceId, citation: edge.citation }]
      };
      if (edge.to === targetId) results.push(path);
      else queue.push({ node: edge.to, nodes: path.nodes, edges: path.edges, provenance: path.provenance, seen: new Set([...current.seen, edge.to]) });
    }
  }
  return results;
}

export function rankEvidencePaths(paths = []) {
  return [...paths].sort((a, b) => {
    const depthDelta = a.edges.length - b.edges.length;
    if (depthDelta) return depthDelta;
    const aProv = a.provenance.length;
    const bProv = b.provenance.length;
    return bProv - aProv;
  });
}
