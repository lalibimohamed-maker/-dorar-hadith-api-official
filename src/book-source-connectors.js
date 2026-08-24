/**
 * Extensible registry for external book sources.
 *
 * Connectors discover metadata and source candidates only. They never grant
 * redistribution rights merely because a file is publicly reachable.
 */

const connectors = new Map();

export function registerBookSourceConnector({ id, name, capabilities = [], discover }) {
  if (!id || !name || typeof discover !== 'function') {
    throw new Error('Book source connector requires id, name and discover()');
  }
  connectors.set(id, Object.freeze({ id, name, capabilities: [...capabilities], discover }));
}

export function listBookSourceConnectors() {
  return [...connectors.values()].map(({ id, name, capabilities }) => ({ id, name, capabilities: [...capabilities] }));
}

export async function discoverBookSources(query, connectorIds = [...connectors.keys()]) {
  const selected = connectorIds.map((id) => connectors.get(id)).filter(Boolean);
  const results = await Promise.all(selected.map(async (connector) => {
    const candidates = await connector.discover(query);
    return { connector: connector.id, candidates: Array.isArray(candidates) ? candidates : [] };
  }));
  return results.flatMap(({ connector, candidates }) => candidates.map((candidate) => ({
    ...candidate,
    connector,
    rightsStatus: candidate.rightsStatus ?? 'rights-unclear',
    redistributionAllowed: candidate.redistributionAllowed === true,
  })));
}

export function selectBestCandidate(candidates = []) {
  const valid = candidates.filter((candidate) => candidate && candidate.url && candidate.connector);
  if (!valid.length) return null;
  // Prefer explicit rights evidence; never infer permission from availability.
  return [...valid].sort((a, b) => Number(b.redistributionAllowed) - Number(a.redistributionAllowed))[0];
}
