import test from 'node:test';
import assert from 'node:assert/strict';
import { createFiveStageNetwork, registerNetworkQuery, registerNetworkResult, advanceNetworkSearch, connectHandoff, startNetworkLearning, processNetworkAttempt, networkHealth, assertNetworkContract, attachFoundationApi } from '../src/rechercher-five-stage-network-engine.js';
import { setRights } from '../src/rechercher-v5-research-foundation-engine.js';

test('V1-V5 network preserves source and rights gates across handoffs', () => {
  const search = { queries: new Map(), results: new Map() };
  const network = createFiveStageNetwork({ search });
  attachFoundationApi(network, { setRights });

  registerNetworkQuery(network, { queryId: 'q1', text: 'فقه الصلاة', language: 'ar', domains: ['FIQH'] });
  network.foundation.sources.set('src1', { sourceId: 'src1', contentHash: 'sha256:test', provenanceVerified: true });
  network.foundation.works.set('w1', { workId: 'w1', title: 'Test Work' });
  registerNetworkResult(network, { queryId: 'q1', resultId: 'r1', sourceId: 'src1', identityState: 'VERIFIED', rightsStatus: 'ALLOWED', evidenceState: 'SOURCE_VERIFIED' });
  advanceNetworkSearch(network, 'q1', 'IDENTITY');
  advanceNetworkSearch(network, 'q1', 'PROVENANCE');
  advanceNetworkSearch(network, 'q1', 'RIGHTS');
  advanceNetworkSearch(network, 'q1', 'EVIDENCE');
  advanceNetworkSearch(network, 'q1', 'SYNTHESIS');
  connectHandoff(network, 'V1_FOUNDATION', 'V2_FEDERATION', { queryId: 'q1' });
  connectHandoff(network, 'V2_FEDERATION', 'V3_DOMAIN_LEARNING', { sourceId: 'src1' });
  network.foundation.sources.get('src1').rightsState = 'ALLOWED';
  const session = startNetworkLearning(network, { sessionId: 's1', learnerId: 'student-1', itemId: 'concept-1', sourceIds: ['src1'] });
  assert.equal(session.stage, 'UNDERSTAND');
  const result = processNetworkAttempt(network, 's1', { conceptId: 'concept-1', skillIds: ['skill-1'], answer: 'test', promptId: 'p1' }, { state: {}, sourceIds: ['src1'] });
  assert.ok(result.gapAction);
  assert.equal(network.state, 'V5_GLOBAL_RESEARCH');
  const plan = network.outputs.get('s1');
  assert.ok(plan);
  const health = networkHealth(network);
  assert.equal(health.handoffs, 4);
  assert.equal(health.verifiedSources, 1);
  assert.equal(health.allowedSources, 1);
  assert.equal(assertNetworkContract(network).state, 'V5_GLOBAL_RESEARCH');
});

test('network rejects backward stage movement', () => {
  const network = createFiveStageNetwork({ search: { queries: new Map(), results: new Map() } });
  connectHandoff(network, 'V1_FOUNDATION', 'V3_DOMAIN_LEARNING');
  assert.throws(() => connectHandoff(network, 'V3_DOMAIN_LEARNING', 'V2_FEDERATION'), /cannot move backwards/);
});
