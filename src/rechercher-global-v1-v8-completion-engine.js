const STATUS_RANK = Object.freeze({
  MISSING: 0,
  PLANNED: 1,
  PARTIAL: 2,
  IMPLEMENTED_FOUNDATION: 3,
  IMPLEMENTED: 4,
});

export const COMPLETION_VERSION = '1.0.0';

export const V1_V8_REQUIREMENTS = Object.freeze({
  V1_FOUNDATION: ['discovery', 'identity', 'provenance', 'rights', 'evidence'],
  V2_FEDERATION: ['source_federation', 'multilingual_alignment', 'adaptive_scheduling', 'manifests', 'reproducibility'],
  V3_DOMAIN_LEARNING: ['quran', 'hadith', 'fiqh', 'tafsir', 'sirah', 'arabic'],
  V4_LEARNING_INTELLIGENCE: ['cognitive_diagnosis', 'retrieval', 'feedback', 'transfer', 'teach_back', 'metacognition'],
  V5_GLOBAL_RESEARCH: ['global_discovery', 'research_trace', 'manuscript_readiness', 'edition_readiness', 'multimodal_alignment'],
  V6_GLOBAL_SOURCE_INTELLIGENCE: ['source_registry', 'identity_deduplication', 'rights_evaluation', 'provenance_validation', 'edition_manifest_linking'],
  V7_EVIDENCE_GRAPH: ['claims', 'evidence', 'contradictions', 'scholar_review', 'attribution_graph', 'scholar_graph', 'hadith_chain_graph', 'fiqh_disagreement_graph', 'multilingual_evidence_graph'],
  V8_ADAPTIVE_LEARNING: ['learner_state', 'prerequisite_diagnosis', 'misconception_detection', 'source_selection', 'adaptive_difficulty', 'retrieval_loop', 'transfer', 'mastery', 'spaced_review'],
});

export const GLOBAL_GATES = Object.freeze([
  'unit_tests',
  'integration_tests',
  'full_ci',
  'security_gates',
  'governance_gates',
  'rights_gate',
  'provenance_gate',
  'immutability_gate',
  'ai_review_gate',
  'continuous_evolution_gate',
]);

const clone = value => structuredClone(value);

function normalizeStatus(status) {
  return STATUS_RANK[status] === undefined ? 'MISSING' : status;
}

export function createGlobalSourceRecord(input = {}) {
  if (!input.sourceId) throw new TypeError('sourceId is required');
  return Object.freeze({
    sourceId: input.sourceId,
    name: input.name || input.sourceId,
    sourceType: input.sourceType || 'WEB',
    accessMode: input.accessMode || 'CATALOG',
    adapterStatus: input.adapterStatus || 'DISCOVERY_ONLY',
    rightsStatus: input.rightsStatus || 'UNKNOWN',
    license: input.license || null,
    jurisdiction: input.jurisdiction || null,
    updateMethod: input.updateMethod || 'MANUAL_REVIEW',
    provenance: input.provenance || null,
    healthStatus: input.healthStatus || 'UNKNOWN',
    lastChecked: input.lastChecked || null,
  });
}

export function evaluateGlobalSourceRegistry(sources = []) {
  const records = sources.map(createGlobalSourceRecord);
  const unique = new Set(records.map(source => source.sourceId));
  const rightsBlocked = records.filter(source => ['UNKNOWN', 'RESTRICTED', 'EXPLICIT_PERMISSION_REQUIRED'].includes(source.rightsStatus));
  const ready = records.filter(source => source.adapterStatus === 'READY' && source.provenance && source.rightsStatus === 'ALLOWED');
  return {
    sourceCount: records.length,
    uniqueSourceCount: unique.size,
    duplicateSourceCount: records.length - unique.size,
    rightsBlockedCount: rightsBlocked.length,
    readySourceCount: ready.length,
    records,
    gates: {
      identity: unique.size === records.length,
      provenance: records.every(source => Boolean(source.provenance)),
      rights: records.every(source => source.rightsStatus !== 'UNKNOWN'),
      readyForAcquisition: ready.length > 0,
    },
  };
}

export function evaluateV1V8Coverage(coverage = {}, evidence = {}) {
  const stages = {};
  for (const [stage, capabilities] of Object.entries(V1_V8_REQUIREMENTS)) {
    const statuses = capabilities.map(capability => normalizeStatus(coverage[capability]));
    const minRank = Math.min(...statuses.map(status => STATUS_RANK[status]));
    const status = Object.entries(STATUS_RANK).find(([, rank]) => rank === minRank)?.[0] || 'MISSING';
    stages[stage] = {
      status,
      capabilities: Object.fromEntries(capabilities.map(capability => [capability, normalizeStatus(coverage[capability])])),
      completionEligible: minRank >= STATUS_RANK.IMPLEMENTED,
    };
  }

  const gateResults = Object.fromEntries(GLOBAL_GATES.map(gate => [gate, evidence[gate] === true]));
  const allStageComplete = Object.values(stages).every(stage => stage.completionEligible);
  const allGatesPass = Object.values(gateResults).every(Boolean);
  const complete = allStageComplete && allGatesPass;
  return {
    version: COMPLETION_VERSION,
    stages,
    gates: gateResults,
    complete,
    state: complete ? 'GLOBAL_OPERATIONAL_COMPLETE' : 'GLOBAL_OPERATIONAL_IN_PROGRESS',
    nextActions: complete ? [] : Object.entries(stages)
      .flatMap(([stage, value]) => Object.entries(value.capabilities).filter(([, status]) => status !== 'IMPLEMENTED').map(([capability, status]) => ({ stage, capability, status })))
      .concat(Object.entries(gateResults).filter(([, pass]) => !pass).map(([gate]) => ({ gate, status: 'BLOCKED' }))),
  };
}

export function assertGlobalCompletion(result) {
  if (!result?.complete) {
    const pending = (result?.nextActions || []).slice(0, 20).map(item => JSON.stringify(item)).join(', ');
    throw new Error(`V1-V8 global completion gate blocked: ${pending}`);
  }
  return true;
}

export function createGlobalCompletionSnapshot({ coverage = {}, evidence = {}, sources = [] } = {}) {
  const sourceRegistry = evaluateGlobalSourceRegistry(sources);
  const result = evaluateV1V8Coverage(coverage, evidence);
  return clone({
    ...result,
    sourceRegistry,
    invariants: {
      unknownRightsNeverPublishable: true,
      restrictedRightsNeverPublishable: true,
      provenanceRequiredForVerification: true,
      originalPdfImmutable: true,
      canonicalQuranArabicImmutable: true,
      aiCannotSelfVerify: true,
      acquisitionIndependentFromLearning: true,
      disagreementsRemainExplicit: true,
      absenceIsNotProofOfAbsence: true,
    },
    continuousEvolution: {
      enabled: true,
      cycle: ['DISCOVER', 'IDENTIFY', 'DEDUPLICATE', 'VERIFY_SOURCE', 'CHECK_RIGHTS', 'ACQUIRE_OR_REFERENCE', 'VALIDATE', 'EXTRACT', 'ALIGN', 'GRAPH', 'EVIDENCE', 'REVIEW', 'PUBLISH_IF_ALLOWED', 'MEASURE_GAPS', 'RESEARCH_AGAIN'],
    },
  });
}

export function createRechercherGlobalV1V8CompletionEngine(input = {}) {
  return {
    version: COMPLETION_VERSION,
    target: 'V1_V8_GLOBAL_OPERATIONAL_COMPLETENESS',
    snapshot: createGlobalCompletionSnapshot(input),
    policy: {
      completeRequiresAllCapabilitiesImplemented: true,
      completeRequiresAllGatesPassing: true,
      noFalseComplete: true,
    },
  };
}
