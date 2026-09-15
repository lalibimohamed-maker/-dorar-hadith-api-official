import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GLOBAL_COMPLETION_GATES,
  STAGE_CONTRACT_REQUIREMENTS,
  createGlobalStageMatrix,
  validateStageContracts,
  evaluateCrossStageHandoffs,
  evaluateGlobalV1V31PlusCompletion,
  assertGlobalV1V31PlusCompletion,
} from '../src/rechercher-global-v1-v31plus-completion-engine.js';

const stages = Array.from({ length: 31 }, (_, i) => ({
  stageId: `V${i + 1}`,
  status: 'IMPLEMENTED',
  capabilities: [`capability_v${i + 1}`],
}));
stages.push({ stageId: 'V31_PLUS', status: 'IMPLEMENTED', capabilities: ['future_extension_contract'] });
const capabilityCoverage = Object.fromEntries(stages.flatMap(s => s.capabilities.map(c => [c, 'IMPLEMENTED'])));
const contracts = stages.map(s => Object.fromEntries(STAGE_CONTRACT_REQUIREMENTS.map(key => [key, key === 'stageId' ? s.stageId : []])));
const handoffs = stages.slice(0, -1).map((s, i) => ({ from: s.stageId, to: stages[i + 1].stageId, producerOutputs: ['x'], consumerInputs: ['x'], compatible: true }));
const gates = Object.fromEntries(GLOBAL_COMPLETION_GATES.map(g => [g, true]));

test('matrix covers V1 through V31+', () => {
  const matrix = createGlobalStageMatrix({ stages, capabilityCoverage });
  assert.equal(matrix.stageCount, 32);
  assert.equal(matrix.familyCounts.V1_V8, 8);
  assert.equal(matrix.familyCounts.V9_V20, 12);
  assert.equal(matrix.familyCounts.V21_V30, 10);
  assert.equal(matrix.familyCounts.V31_PLUS, 2);
});

test('contracts require the full shared stage-node contract', () => {
  assert.equal(validateStageContracts(contracts).valid, true);
  const broken = { ...contracts[0] };
  delete broken.handoffs;
  assert.equal(validateStageContracts([broken]).valid, false);
});

test('cross-stage handoffs are load-bearing', () => {
  assert.equal(evaluateCrossStageHandoffs(handoffs).valid, true);
  assert.equal(evaluateCrossStageHandoffs([{ from: 'V1', to: 'V2', producerOutputs: ['x'], consumerInputs: ['y'], compatible: false }]).valid, false);
});

test('global gate cannot claim complete when any V1-V31+ stage or gate is incomplete', () => {
  const result = evaluateGlobalV1V31PlusCompletion({ stages, capabilityCoverage, contracts, handoffs, gates });
  assert.equal(result.complete, true);
  const blocked = evaluateGlobalV1V31PlusCompletion({ stages: stages.map(s => s.stageId === 'V24' ? { ...s, status: 'PARTIAL' } : s), capabilityCoverage, contracts, handoffs, gates });
  assert.equal(blocked.complete, false);
  assert.throws(() => assertGlobalV1V31PlusCompletion(blocked), /V1-V31\+ global completion gate blocked/);
  const gateBlocked = evaluateGlobalV1V31PlusCompletion({ stages, capabilityCoverage, contracts, handoffs, gates: { ...gates, scholar_review_gate: false } });
  assert.equal(gateBlocked.complete, false);
});

test('V31+ remains extensible but is never exempt from contracts and gates', () => {
  const result = evaluateGlobalV1V31PlusCompletion({ stages, capabilityCoverage, contracts, handoffs, gates });
  const v31 = result.matrix.stages.find(s => s.stageId === 'V31_PLUS');
  assert.equal(v31.family, 'V31_PLUS');
  assert.equal(v31.completionEligible, true);
});
