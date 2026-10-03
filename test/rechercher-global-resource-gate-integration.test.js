import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGlobalV1V31PlusCompletion } from '../src/rechercher-global-v1-v31plus-completion-engine.js';

const stages = [{ stageId: 'V1', status: 'IMPLEMENTED', capabilities: ['foundation'] }];
const capabilityCoverage = { foundation: 'IMPLEMENTED' };
const contract = [{ stageId: 'V1', version: '1', capabilities: [], acceptedInputs: [], producedOutputs: [], requiredEvidence: [], rightsPolicy: {}, reviewPolicy: {}, dependencies: [], handoffs: [] }];
const gates = Object.fromEntries(['unit_tests','integration_tests','contract_tests','full_ci','security_gates','governance_gates','rights_gate','provenance_gate','immutability_gate','scholar_review_gate','ai_authority_boundary_gate','cross_stage_handoff_gate','resource_registry_gate','observability_gate','rollback_recovery_gate','continuous_evolution_gate'].map(g => [g, true]));

test('resource audit is a real completion gate when supplied', () => {
  const blocked = evaluateGlobalV1V31PlusCompletion({ stages, capabilityCoverage, contracts: contract, handoffs: [], gates, resourceAudit: { complete: false } });
  assert.equal(blocked.complete, false);
  assert.equal(blocked.gates.resource_registry_gate, false);
  assert.ok(blocked.nextActions.some(a => a.type === 'GATE' && a.gate === 'resource_registry_gate'));

  const passed = evaluateGlobalV1V31PlusCompletion({ stages, capabilityCoverage, contracts: contract, handoffs: [], gates, resourceAudit: { complete: true } });
  assert.equal(passed.gates.resource_registry_gate, true);
  assert.equal(passed.complete, true);
});