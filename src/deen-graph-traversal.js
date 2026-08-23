import { neighbors } from './deen-graph-runtime.js';

export function traverse(graph, startId, { maxDepth = 3, edgeTypes = null, nodeTypes = null } = {}) {
  const allowedNodes = nodeTypes ? new Set(nodeTypes) : null;
  const seen = new Set([startId]);
  const queue = [{ id: startId, depth: 0 }];
  const results = [];
  while (queue.length) {
    const current = queue.shift();
    if (current.depth >= maxDepth) continue;
    for (const node of neighbors(graph, current.id, { edgeTypes })) {
      if (seen.has(node.id)) continue;
      seen.add(node.id);
      if (!allowedNodes || allowedNodes.has(node.type)) results.push({ node, depth: current.depth + 1 });
      queue.push({ id: node.id, depth: current.depth + 1 });
    }
  }
  return results;
}

export function explainPath(graph, startId, { maxDepth = 4, edgeTypes = null } = {}) {
  return traverse(graph, startId, { maxDepth, edgeTypes }).map(({ node, depth }) => ({
    id: node.id,
    type: node.type,
    depth,
    evidence: node.evidence || []
  }));
}
