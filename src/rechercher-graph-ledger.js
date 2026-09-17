import { createHash, sign, verify, generateKeyPairSync } from 'node:crypto';

export const GRAPH_LEDGER_VERSION = '1.0.0';
export const GRAPH_EVENT_TYPES = Object.freeze([
  'NODE_CREATED', 'NODE_STATE_CHANGED', 'EDGE_CREATED', 'EDGE_STATE_CHANGED',
  'CLAIM_VERIFIED', 'CLAIM_SUSPENDED', 'CLAIM_ISOLATED', 'REVIEW_RECORDED'
]);

const canonical = value => JSON.stringify(value, Object.keys(value || {}).sort());
const hashEvent = event => createHash('sha256').update(canonical(event)).digest('hex');

export function createGraphLedger({ ledgerId = 'rechercher-global-graph', signer = null } = {}) {
  return { ledgerId, stateVersion: 0, events: [], heads: new Map(), signer, snapshots: new Map() };
}

export function appendGraphEvent(ledger, input = {}) {
  if (!ledger || !input.entityId || !input.eventType) throw new TypeError('ledger, entityId and eventType are required');
  if (!GRAPH_EVENT_TYPES.includes(input.eventType)) throw new TypeError(`unsupported graph event type: ${input.eventType}`);
  const previous = ledger.events.at(-1) || null;
  const stateVersion = ++ledger.stateVersion;
  const payload = {
    ledgerId: ledger.ledgerId,
    sequence: stateVersion,
    stateVersion,
    timestamp: input.timestamp || new Date().toISOString(),
    entityType: input.entityType || 'UNKNOWN',
    entityId: input.entityId,
    eventType: input.eventType,
    payload: structuredClone(input.payload || {}),
    previousEventHash: previous?.eventHash || null
  };
  const eventHash = hashEvent(payload);
  const signature = ledger.signer?.privateKey
    ? sign(null, Buffer.from(eventHash), ledger.signer.privateKey).toString('base64')
    : null;
  const event = Object.freeze({ ...payload, eventHash, signature, immutable: true });
  ledger.events.push(event);
  ledger.heads.set(input.entityId, eventHash);
  return structuredClone(event);
}

export function verifyGraphLedger(ledger, publicKey = ledger?.signer?.publicKey) {
  let previous = null;
  for (const event of ledger.events) {
    const { eventHash, signature, immutable, ...payload } = event;
    if (!immutable || hashEvent(payload) !== eventHash || (payload.previousEventHash !== (previous?.eventHash || null))) return false;
    if (signature && publicKey && !verify(null, Buffer.from(eventHash), publicKey, Buffer.from(signature, 'base64'))) return false;
    previous = event;
  }
  return true;
}

export function materializeGraphAt(ledger, stateVersion = ledger.events.length) {
  if (!Number.isInteger(stateVersion) || stateVersion < 0 || stateVersion > ledger.events.length) throw new RangeError('invalid stateVersion');
  const nodes = new Map();
  const edges = new Map();
  for (const event of ledger.events.slice(0, stateVersion)) {
    const target = event.entityType === 'EDGE' ? edges : nodes;
    const current = target.get(event.entityId) || { entityId: event.entityId, stateVersion: 0, history: [] };
    const next = { ...current, ...structuredClone(event.payload), stateVersion: event.stateVersion, status: event.eventType, history: [...current.history, event.eventHash] };
    target.set(event.entityId, next);
  }
  const snapshot = { ledgerId: ledger.ledgerId, stateVersion, nodes: Object.fromEntries(nodes), edges: Object.fromEntries(edges) };
  ledger.snapshots.set(stateVersion, structuredClone(snapshot));
  return snapshot;
}

export function timeTravelQuery(ledger, { stateVersion, entityId = null } = {}) {
  const graph = materializeGraphAt(ledger, stateVersion);
  if (!entityId) return graph;
  return graph.nodes[entityId] || graph.edges[entityId] || null;
}

export function createLedgerSigner() {
  return generateKeyPairSync('ed25519');
}
