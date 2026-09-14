import test from 'node:test';
import assert from 'node:assert/strict';
import { createStageNetworkRegistry, registerNode, validateHandoff, routeHandoff, requestReplan, networkCapabilities } from '../src/rechercher-stage-network-registry.js';
import { createStageNodeContract } from '../src/rechercher-stage-node-contract.js';

const node = (stageId, input, output, dependency = []) => createStageNodeContract({
  stageId, version: '1.0', capabilities: ['TEST_CAPABILITY'],
  acceptedInputs: [{ type: input }], producedOutputs: [{ type: output }],
  requiredEvidence: [{ type: 'SOURCE_IDENTITY' }],
  rightsPolicy: { defaultState: 'UNKNOWN', publishableState: 'ALLOWED' },
  reviewPolicy: { scholarlyVerification: true }, dependencies, handoffs: [input]
});

test('registry validates V5 to future-node handoff', () => {
  const registry = createStageNetworkRegistry();
  registerNode(registry, node('V5_GLOBAL_RESEARCH', 'STAGE_OUTPUT', 'RESEARCH_OUTPUT'));
  registerNode(registry, node('V6_GLOBAL_SOURCE_INTELLIGENCE', 'RESEARCH_OUTPUT', 'FUTURE_OUTPUT', ['V5_GLOBAL_RESEARCH']));
  assert.equal(validateHandoff(registry, 'V5_GLOBAL_RESEARCH', 'V6_GLOBAL_SOURCE_INTELLIGENCE'), true);
  const route = routeHandoff(registry, 'V5_GLOBAL_RESEARCH', 'V6_GLOBAL_SOURCE_INTELLIGENCE', { traceId: 't-1' });
  assert.equal(route.traceId, 't-1');
});

test('registry records observable replan without implementing future stage', () => {
  const registry = createStageNetworkRegistry();
  registerNode(registry, node('V21_EVIDENCE_INTELLIGENCE', 'RESEARCH_OUTPUT', 'FUTURE_OUTPUT'));
  const event = requestReplan(registry, 'missing-evidence', { traceId: 't-2', stage: 'V21_EVIDENCE_INTELLIGENCE' });
  assert.equal(event.traceId, 't-2');
  assert.equal(registry.traces.at(-1).type, 'REPLAN_REQUESTED');
  assert.equal(networkCapabilities(registry)[0].status, 'OPEN_EXTENSION_POINT');
});

test('registry rejects incompatible handoff', () => {
  const registry = createStageNetworkRegistry();
  registerNode(registry, node('V5_GLOBAL_RESEARCH', 'STAGE_OUTPUT', 'RESEARCH_OUTPUT'));
  registerNode(registry, node('V6_GLOBAL_SOURCE_INTELLIGENCE', 'WRONG_INPUT', 'FUTURE_OUTPUT'));
  assert.throws(() => validateHandoff(registry, 'V5_GLOBAL_RESEARCH', 'V6_GLOBAL_SOURCE_INTELLIGENCE'), /handoff contract mismatch/);
});
