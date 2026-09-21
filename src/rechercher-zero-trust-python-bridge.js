import { createHash, randomUUID } from 'node:crypto';

export const BRIDGE_PROTOCOL_VERSION = '1.0.0';
export const ALLOWED_ABSTRACTIONS = Object.freeze(['TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'PDF_PAGE', 'EMBEDDING', 'OCR', 'ASR', 'ALIGNMENT']);

export function createZeroTrustBridge({ socketPath = '/run/rechercher/python-worker.sock', maxBytes = 64 * 1024 * 1024 } = {}) {
  return { socketPath, maxBytes, trustedWorkerIds: new Set(), activeRequests: new Map(), graphAccess: false, databaseAccess: false };
}

export function registerSandboxWorker(bridge, worker = {}) {
  if (!worker.workerId || !worker.imageDigest) throw new TypeError('workerId and immutable imageDigest are required');
  if (worker.networkAccess === true || worker.graphAccess === true || worker.databaseAccess === true) throw new Error('worker violates zero-trust isolation policy');
  bridge.trustedWorkerIds.add(worker.workerId);
  return { workerId: worker.workerId, imageDigest: worker.imageDigest, networkAccess: false, graphAccess: false, databaseAccess: false, protocol: BRIDGE_PROTOCOL_VERSION };
}

export function createBridgeRequest(bridge, { workerId, modality, bytes, contentHash, operation = 'ABSTRACT' } = {}) {
  if (!bridge.trustedWorkerIds.has(workerId)) throw new Error('untrusted worker');
  if (!ALLOWED_ABSTRACTIONS.includes(modality)) throw new TypeError(`unsupported modality: ${modality}`);
  if (!Number.isInteger(bytes) || bytes < 0 || bytes > bridge.maxBytes) throw new RangeError('media exceeds bridge byte budget');
  if (!contentHash) throw new TypeError('contentHash is required');
  const request = Object.freeze({ requestId: randomUUID(), protocol: BRIDGE_PROTOCOL_VERSION, workerId, operation, modality, byteLength: bytes, contentHash, createdAt: new Date().toISOString(), graphAccess: false, databaseAccess: false, credentialForwarding: false });
  bridge.activeRequests.set(request.requestId, request);
  return request;
}

export function acceptBridgeResult(bridge, requestId, result = {}) {
  const request = bridge.activeRequests.get(requestId);
  if (!request) throw new Error('unknown bridge request');
  if (result.graphWrite || result.databaseWrite || result.credentialsRequested || result.networkEgress) throw new Error('bridge result violates zero-trust output boundary');
  if (!ALLOWED_ABSTRACTIONS.includes(result.modality || request.modality)) throw new TypeError('invalid result modality');
  if (result.inputHash && result.inputHash !== request.contentHash) throw new Error('result input hash mismatch');
  const abstraction = Object.freeze({ requestId, modality: result.modality || request.modality, inputHash: request.contentHash, outputHash: result.outputHash || createHash('sha256').update(JSON.stringify(result.payload || null)).digest('hex'), payload: structuredClone(result.payload || null), model: result.model || null, modelHash: result.modelHash || null, provenance: structuredClone(result.provenance || {}), createdAt: new Date().toISOString() });
  bridge.activeRequests.delete(requestId);
  return abstraction;
}
