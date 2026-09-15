import { assertNodeCompatibility, validateStageNodeContract } from './rechercher-stage-node-contract.js';

export function createStageNetworkRegistry({ observability = null } = {}) {
  return { nodes: new Map(), routes: [], traces: [], observability };
}

export function registerNode(registry, node) {
  validateStageNodeContract(node);
  if (registry.nodes.has(node.stageId)) throw new Error(`node already registered: ${node.stageId}`);
  registry.nodes.set(node.stageId, structuredClone(node));
  recordTrace(registry, 'NODE_REGISTERED', { stageId: node.stageId });
  return structuredClone(node);
}

export function attachNode(registry, node) {
  return registerNode(registry, node);
}

export function validateHandoff(registry, fromStage, toStage) {
  const producer = registry.nodes.get(fromStage);
  const consumer = registry.nodes.get(toStage);
  if (!producer || !consumer) throw new Error('handoff node not registered');
  assertNodeCompatibility(producer, consumer);
  return true;
}

export function routeHandoff(registry, fromStage, toStage, payload = {}) {
  validateHandoff(registry, fromStage, toStage);
  const traceId = payload.traceId || createTraceId(registry);
  const route = { fromStage, toStage, traceId, payload: structuredClone(payload) };
  registry.routes.push(route);
  recordTrace(registry, 'HANDOFF_ROUTED', route, traceId);
  return structuredClone(route);
}

export function createTraceId(registry) {
  return `rechercher-node-trace-${registry.traces.length + 1}`;
}

export function recordTrace(registry, type, payload = {}, traceId = null) {
  const id = traceId || createTraceId(registry);
  const event = { traceId: id, type, at: new Date().toISOString(), ...structuredClone(payload) };
  registry.traces.push(event);
  if (registry.observability?.record) registry.observability.record(event);
  return id;
}

export function requestReplan(registry, reason, context = {}) {
  const traceId = context.traceId || createTraceId(registry);
  return { reason, traceId, context: structuredClone(context), recorded: Boolean(recordTrace(registry, 'REPLAN_REQUESTED', { reason, context }, traceId)) };
}

export function networkCapabilities(registry) {
  return [...registry.nodes.values()].map(node => ({ stageId: node.stageId, status: node.status, capabilities: [...node.capabilities] }));
}
