import test from 'node:test';
import assert from 'node:assert/strict';
import { createGraphLedger, appendGraphEvent, materializeGraphAt, verifyGraphLedger, createLedgerSigner, timeTravelQuery } from '../src/rechercher-graph-ledger.js';
import { createOrchestrationEngine, enqueueResearchTask, admitNextTask, orchestrationSnapshot } from '../src/rechercher-orchestration-engine.js';
import { scoreGroundedConfidence, createClaimEvidenceRecord } from '../src/rechercher-grounded-confidence.js';
import { createZeroTrustBridge, registerSandboxWorker, createBridgeRequest, acceptBridgeResult } from '../src/rechercher-zero-trust-python-bridge.js';
import { canonicalWorkUri, createWorkIdentity, createExpression, createTranslationEdge } from '../src/rechercher-cross-lingual-entity-fixity.js';

test('graph ledger is append-only, hash chained, signed and time-travelable', () => {
  const keyPair = createLedgerSigner();
  const ledger = createGraphLedger({ signer: keyPair });
  appendGraphEvent(ledger, { entityType: 'CLAIM', entityId: 'c1', eventType: 'NODE_CREATED', payload: { state: 'UNVERIFIED' } });
  appendGraphEvent(ledger, { entityType: 'CLAIM', entityId: 'c1', eventType: 'CLAIM_VERIFIED', payload: { state: 'VERIFIED', reviewer: 'scholar-1' } });
  assert.equal(materializeGraphAt(ledger, 1).nodes.c1.state, 'UNVERIFIED');
  assert.equal(timeTravelQuery(ledger, { stateVersion: 2, entityId: 'c1' }).state, 'VERIFIED');
  assert.equal(verifyGraphLedger(ledger), true);
  assert.equal(ledger.events.length, 2);
});

test('orchestrator prioritizes gap-driven work and applies backpressure', () => {
  const engine = createOrchestrationEngine({ capacity: 5, refillPerSecond: 1, concurrency: 1 });
  enqueueResearchTask(engine, { taskId: 'archive', kind: 'ARCHIVE', queueClass: 'ARCHIVE', estimatedCost: 4 });
  enqueueResearchTask(engine, { taskId: 'gap', kind: 'GAP', queueClass: 'GAP_DRIVEN', estimatedCost: 4 });
  const first = admitNextTask(engine, 0);
  assert.equal(first.taskId, 'gap');
  const blocked = admitNextTask(engine, 0);
  assert.equal(blocked, null);
  assert.equal(orchestrationSnapshot(engine).active, 1);
});

test('confidence remains neutral to accepted variation and marks true contradiction disputed', () => {
  const variation = scoreGroundedConfidence({ sourceAuthenticity: 1, transmissionChains: 0.9, scholarlyConsensus: 0.9, conflictType: 'ACCEPTED_VARIATION' });
  const contradiction = scoreGroundedConfidence({ sourceAuthenticity: 1, transmissionChains: 0.9, scholarlyConsensus: 0.9, conflictType: 'TRUE_CONTRADICTION' });
  assert.equal(variation.state, 'SUPPORTED');
  assert.equal(contradiction.state, 'DISPUTED');
  assert.ok(contradiction.confidence < variation.confidence);
  assert.throws(() => createClaimEvidenceRecord({ claimId: 'c1' }));
});

test('zero-trust bridge exposes only modality abstractions', () => {
  const bridge = createZeroTrustBridge({ maxBytes: 1024 });
  registerSandboxWorker(bridge, { workerId: 'w1', imageDigest: 'sha256:abc', networkAccess: false, graphAccess: false, databaseAccess: false });
  const request = createBridgeRequest(bridge, { workerId: 'w1', modality: 'PDF_PAGE', bytes: 100, contentHash: 'sha256:input' });
  assert.equal(request.graphAccess, false);
  assert.throws(() => acceptBridgeResult(bridge, request.requestId, { graphWrite: true, modality: 'PDF_PAGE' }));
  const result = acceptBridgeResult(bridge, request.requestId, { modality: 'PDF_PAGE', inputHash: 'sha256:input', payload: { text: 'abstracted' } });
  assert.equal(result.inputHash, 'sha256:input');
});

test('cross-lingual identity anchors translations to one immutable work', () => {
  const uri = canonicalWorkUri({ originalLanguage: 'ar', normalizedTitle: 'al-muwatta', creatorAuthorityId: 'author-1' });
  const work = createWorkIdentity({ originalLanguage: 'ar', normalizedTitle: 'al-muwatta', creatorAuthorityId: 'author-1', canonicalUri: uri });
  const en = createExpression({ workUri: uri, language: 'en', translatorAuthorityId: 'translator-en' });
  const fr = createExpression({ workUri: uri, language: 'fr', translatorAuthorityId: 'translator-fr' });
  const edge = createTranslationEdge({ sourceExpressionId: en.expressionId, translatedExpressionId: fr.expressionId, sourceWorkUri: uri, evidence: { source: 'catalog' } });
  assert.equal(work.canonicalUri, uri);
  assert.equal(en.workUri, uri);
  assert.equal(fr.workUri, uri);
  assert.equal(edge.type, 'TRANSLATION_OF');
});
