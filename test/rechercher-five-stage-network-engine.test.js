import test from 'node:test';
import assert from 'node:assert/strict';
import { createFiveStageNetwork, registerNetworkQuery, registerNetworkResult, advanceNetworkSearch, connectHandoff, startNetworkLearning, processNetworkAttempt, networkHealth, assertNetworkContract, registerBuiltInNetworkNodes, registerFutureStage, createStageNodeContract, assertNodeCompatibility, requestReplan, networkObservability } from '../src/rechercher-five-stage-network-engine.js';

test('V1-V5 network preserves source and rights gates across handoffs', () => {
  const search = { queries: new Map(), results: new Map() };
  const network = createFiveStageNetwork({ search });
  registerBuiltInNetworkNodes(network);
  registerNetworkQuery(network, { queryId: 'q1', text: 'فقه الصلاة', language: 'ar', domains: ['FIQH'] });
  network.foundation.sources.set('src1', { sourceId: 'src1', contentHash: 'sha256:test', provenanceVerified: true, rightsState: 'ALLOWED' });
  registerNetworkResult(network, { queryId: 'q1', resultId: 'r1', sourceId: 'src1', identityState: 'VERIFIED', rightsStatus: 'ALLOWED', evidenceState: 'SOURCE_VERIFIED' });
  for (const stage of ['IDENTITY','PROVENANCE','RIGHTS','EVIDENCE','SYNTHESIS']) advanceNetworkSearch(network, 'q1', stage);
  connectHandoff(network, 'V1_FOUNDATION', 'V2_FEDERATION', { queryId: 'q1' });
  connectHandoff(network, 'V2_FEDERATION', 'V3_DOMAIN_LEARNING', { sourceId: 'src1' });
  const session = startNetworkLearning(network, { sessionId: 's1', learnerId: 'student-1', itemId: 'concept-1', sourceIds: ['src1'] });
  assert.equal(session.stage, 'UNDERSTAND');
  const result = processNetworkAttempt(network, 's1', { conceptId: 'concept-1', skillIds: ['skill-1'], answer: 'test', promptId: 'p1' }, { state: {}, sourceIds: ['src1'] });
  assert.ok(result.gapAction);
  assert.equal(network.state, 'V5_GLOBAL_RESEARCH');
  const health = networkHealth(network);
  assert.equal(health.handoffs, 4);
  assert.equal(health.verifiedSources, 1);
  assert.equal(health.allowedSources, 1);
  assert.equal(health.nodes, 5);
  assert.equal(assertNetworkContract(network).state, 'V5_GLOBAL_RESEARCH');
  assert.ok(networkObservability(network).traceCount > 0);
});

test('future stages register as extension points without becoming implemented', () => {
  const network = createFiveStageNetwork({ search: { queries: new Map(), results: new Map() } });
  registerBuiltInNetworkNodes(network);
  const future = createStageNodeContract({ stageId: 'V6_GLOBAL_SOURCE_INTELLIGENCE', version: '1.0', capabilities: ['SOURCE_FEDERATION'], acceptedInputs: [{ type: 'RESEARCH_OUTPUT' }], producedOutputs: [{ type: 'FUTURE_OUTPUT' }], requiredEvidence: [{ type: 'SOURCE_IDENTITY' }], rightsPolicy: { defaultState: 'UNKNOWN', publishableState: 'ALLOWED' }, reviewPolicy: { scholarlyVerification: true }, dependencies: ['V5_GLOBAL_RESEARCH'], handoffs: ['RESEARCH_OUTPUT'] });
  registerFutureStage(network, future);
  assert.equal(network.nodes.get('V6_GLOBAL_SOURCE_INTELLIGENCE').status, 'OPEN_EXTENSION_POINT');
  assert.equal(network.nodes.size, 6);
  assert.doesNotThrow(() => assertNodeCompatibility(network.nodes.get('V5_GLOBAL_RESEARCH'), network.nodes.get('V6_GLOBAL_SOURCE_INTELLIGENCE')));
});

test('future nodes cannot weaken immutable safety invariants', () => {
  assert.throws(() => createStageNodeContract({ stageId: 'V21_EVIDENCE', version: '1.0', capabilities: ['TEST'], acceptedInputs: [{ type: 'RESEARCH_OUTPUT' }], producedOutputs: [{ type: 'FUTURE_OUTPUT' }], requiredEvidence: [{ type: 'SOURCE_IDENTITY' }], rightsPolicy: { defaultState: 'UNKNOWN', publishableState: 'ALLOWED' }, reviewPolicy: { scholarlyVerification: true }, dependencies: [], handoffs: [], safety: { canOverrideRights: true } }), /immutable safety invariant/);
});

test('trace id propagates and replan is observable', () => {
  const network = createFiveStageNetwork({ search: { queries: new Map(), results: new Map() } });
  const handoff = connectHandoff(network, 'V1_FOUNDATION', 'V2_FEDERATION', { traceId: 'trace-fixed' });
  assert.equal(handoff.payload.traceId, 'trace-fixed');
  const replan = requestReplan(network, 'knowledge-gap', { traceId: 'trace-fixed', stage: 'V2_FEDERATION' });
  assert.equal(replan.traceId, 'trace-fixed');
  assert.equal(networkObservability(network).replanCount, 1);
});

test('network rejects backward stage movement', () => {
  const network = createFiveStageNetwork({ search: { queries: new Map(), results: new Map() } });
  connectHandoff(network, 'V1_FOUNDATION', 'V3_DOMAIN_LEARNING');
  assert.throws(() => connectHandoff(network, 'V3_DOMAIN_LEARNING', 'V2_FEDERATION'), /cannot move backwards/);
});
