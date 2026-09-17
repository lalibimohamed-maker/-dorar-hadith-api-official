const STATUS_RANK = Object.freeze({ MISSING: 0, PLANNED: 1, PARTIAL: 2, IMPLEMENTED_FOUNDATION: 3, IMPLEMENTED: 4 });
export const GLOBAL_COMPLETION_VERSION = '2.0.0';
export const STAGE_FAMILIES = Object.freeze({
  V1_V8: { from: 1, to: 8, purpose: 'foundation_to_adaptive_learning' },
  V9_V20: { from: 9, to: 20, purpose: 'global_deep_research_worldwide_evolution_knowledge_intelligence_education' },
  V21_V30: { from: 21, to: 30, purpose: 'world_knowledge_intelligence' },
  V31_PLUS: { from: 31, to: null, purpose: 'knowledge_commons_research_ecosystem_and_future_extensions' },
});
export const GLOBAL_COMPLETION_GATES = Object.freeze(['unit_tests','integration_tests','contract_tests','full_ci','security_gates','governance_gates','rights_gate','provenance_gate','immutability_gate','scholar_review_gate','ai_authority_boundary_gate','cross_stage_handoff_gate','resource_registry_gate','observability_gate','rollback_recovery_gate','continuous_evolution_gate']);
export const STAGE_CONTRACT_REQUIREMENTS = Object.freeze(['stageId','version','capabilities','acceptedInputs','producedOutputs','requiredEvidence','rightsPolicy','reviewPolicy','dependencies','handoffs']);
const clone = value => structuredClone(value);
const normalizeStatus = status => STATUS_RANK[status] === undefined ? 'MISSING' : status;
function stageFamilyFor(n) { if (n <= 8) return 'V1_V8'; if (n <= 20) return 'V9_V20'; if (n <= 30) return 'V21_V30'; return 'V31_PLUS'; }
export function createStageRequirement({ stageId, family, capabilities = [], status = 'MISSING', contract = null } = {}) { if (!stageId) throw new TypeError('stageId is required'); const n = Number(String(stageId).match(/\d+/)?.[0] || 31); return Object.freeze({ stageId, family: family || stageFamilyFor(n), capabilities: [...new Set(capabilities)], status: normalizeStatus(status), contract }); }
export function createGlobalStageMatrix({ stages = [], capabilityCoverage = {} } = {}) { const normalized = stages.map(createStageRequirement); const matrix = normalized.map(stage => { const capabilityStatuses = Object.fromEntries(stage.capabilities.map(c => [c, normalizeStatus(capabilityCoverage[c])])); const ranks = Object.values(capabilityStatuses).map(normalizeStatus).map(s => STATUS_RANK[s]); const minimumRank = ranks.length ? Math.min(STATUS_RANK[stage.status], ...ranks) : STATUS_RANK[stage.status]; return { ...stage, capabilityStatuses, completionEligible: minimumRank >= STATUS_RANK.IMPLEMENTED }; }); return { stageCount: matrix.length, familyCounts: Object.fromEntries(Object.keys(STAGE_FAMILIES).map(f => [f, matrix.filter(s => s.family === f).length])), stages: matrix }; }
export function validateStageContracts(contracts = []) { const results = contracts.map(contract => { const missing = STAGE_CONTRACT_REQUIREMENTS.filter(k => contract?.[k] === undefined); return { stageId: contract?.stageId || null, valid: missing.length === 0, missing }; }); return { valid: results.every(r => r.valid), results }; }
export function evaluateCrossStageHandoffs(handoffs = []) { const results = handoffs.map(h => ({ from: h?.from || null, to: h?.to || null, valid: Boolean(h?.from && h?.to && h?.producerOutputs && h?.consumerInputs), compatible: Boolean(h?.compatible) })); return { count: results.length, valid: results.every(r => r.valid && r.compatible), results }; }
export function evaluateGlobalV1V31PlusCompletion({ stages = [], capabilityCoverage = {}, contracts = [], handoffs = [], gates = {}, resourceAudit = null } = {}) {
  const matrix = createGlobalStageMatrix({ stages, capabilityCoverage });
  const contractResult = validateStageContracts(contracts);
  const handoffResult = evaluateCrossStageHandoffs(handoffs);
  const gateResults = Object.fromEntries(GLOBAL_COMPLETION_GATES.map(g => [g, gates[g] === true]));
  if (resourceAudit) gateResults.resource_registry_gate = gates.resource_registry_gate === true && resourceAudit.complete === true;
  const stageResults = matrix.stages.map(stage => { const ranks = Object.values(stage.capabilityStatuses).map(normalizeStatus).map(s => STATUS_RANK[s]); const minimumRank = ranks.length ? Math.min(STATUS_RANK[stage.status], ...ranks) : STATUS_RANK[stage.status]; return { stageId: stage.stageId, family: stage.family, status: Object.entries(STATUS_RANK).find(([, r]) => r === minimumRank)?.[0] || 'MISSING', completionEligible: minimumRank >= STATUS_RANK.IMPLEMENTED }; });
  const allStagesComplete = stageResults.length > 0 && stageResults.every(s => s.completionEligible);
  const allGatesPass = Object.values(gateResults).every(Boolean);
  const complete = allStagesComplete && contractResult.valid && handoffResult.valid && allGatesPass;
  const nextActions = stageResults.filter(s => !s.completionEligible).map(s => ({ type: 'STAGE', stageId: s.stageId, status: s.status }));
  if (!contractResult.valid) nextActions.push({ type: 'CONTRACTS', status: 'BLOCKED' });
  if (!handoffResult.valid) nextActions.push({ type: 'HANDOFFS', status: 'BLOCKED' });
  for (const [gate, pass] of Object.entries(gateResults)) if (!pass) nextActions.push({ type: 'GATE', gate, status: 'BLOCKED' });
  return { version: GLOBAL_COMPLETION_VERSION, scope: 'V1_V31_PLUS', stageFamilies: STAGE_FAMILIES, matrix, contracts: contractResult, handoffs: handoffResult, gates: gateResults, resourceAudit: resourceAudit ? clone(resourceAudit) : null, complete, state: complete ? 'GLOBAL_OPERATIONAL_COMPLETE' : 'GLOBAL_OPERATIONAL_IN_PROGRESS', nextActions };
}
export function assertGlobalV1V31PlusCompletion(result) { if (!result?.complete) throw new Error(`V1-V31+ global completion gate blocked: ${JSON.stringify((result?.nextActions || []).slice(0, 20))}`); return true; }
export function createRechercherGlobalV1V31PlusCompletionEngine(input = {}) { const snapshot = evaluateGlobalV1V31PlusCompletion(input); return { version: GLOBAL_COMPLETION_VERSION, target: 'V1_V31_PLUS_GLOBAL_OPERATIONAL_COMPLETENESS', snapshot: clone(snapshot), policy: { noFalseComplete: true, completionRequiresEveryRegisteredStage: true, completionRequiresContractCompatibility: true, completionRequiresCrossStageHandoffs: true, completionRequiresAllGlobalGates: true, completionRequiresResourceAuditWhenProvided: true, v31PlusIsOpenEndedButNeverExemptFromTheSameGates: true, learningNeverOverridesRightsOrScholarlyAuthority: true, acquisitionNeverDependsOnLearning: true } }; }
