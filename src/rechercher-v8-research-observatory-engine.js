export const V8_RESEARCH_OBSERVATORY_VERSION = '8.0.0';
export const V8_RESEARCH_OBSERVATORY_STAGE_ID = 'V8_RESEARCH_OBSERVATORY';

const clone = (value) => structuredClone(value);
const requireId = (value, name) => {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${name} is required`);
};
const clamp = (value) => Math.max(0, Math.min(1, Number(value) || 0));

export const GAP_TYPES = Object.freeze([
  'MISSING_EVIDENCE',
  'SOURCE_COVERAGE',
  'UNRESOLVED_CONTRADICTION',
  'TERMINOLOGY_ALIGNMENT',
  'RIGHTS_BLOCKED',
  'REVIEW_PENDING'
]);

export function createRuntime({ graphRuntime = null } = {}) {
  return {
    version: V8_RESEARCH_OBSERVATORY_VERSION,
    graphRuntime,
    gaps: new Map(),
    observations: [],
    traces: []
  };
}

function record(runtime, type, payload = {}) {
  const event = {
    traceId: `rechercher-v8-observatory-${runtime.traces.length + 1}`,
    type,
    at: new Date().toISOString(),
    ...clone(payload)
  };
  runtime.traces.push(event);
  return event.traceId;
}

export function createKnowledgeGap(input = {}) {
  requireId(input.gapId, 'gapId');
  requireId(input.topic, 'topic');
  if (!GAP_TYPES.includes(input.type)) throw new Error(`unsupported gap type: ${input.type}`);
  if (!input.provenance) throw new Error('gap provenance is required');
  return Object.freeze({
    gapId: input.gapId,
    topic: input.topic,
    type: input.type,
    severity: input.severity || 'MEDIUM',
    status: input.status || 'OPEN',
    evidenceIds: [...(input.evidenceIds || [])],
    sourceIds: [...(input.sourceIds || [])],
    uncertainty: clamp(input.uncertainty),
    provenance: clone(input.provenance),
    createdAt: input.createdAt || new Date().toISOString()
  });
}

export function addKnowledgeGap(runtime, input = {}) {
  const gap = createKnowledgeGap(input);
  runtime.gaps.set(gap.gapId, gap);
  record(runtime, 'KNOWLEDGE_GAP_CREATED', { gapId: gap.gapId, type: gap.type, topic: gap.topic });
  return clone(gap);
}

export function observeGraph(runtime, { topic = null } = {}) {
  const graph = runtime.graphRuntime;
  const claims = graph?.claims ? [...graph.claims.values()] : [];
  const evidences = graph?.evidences ? [...graph.evidences.values()] : [];
  const contradictions = graph?.contradictions ? [...graph.contradictions.values()] : [];
  const sources = graph?.sourceEngine?.sources ? [...graph.sourceEngine.sources.values()] : [];
  const publicSources = sources.filter((s) => s.state === 'VERIFIED_SOURCE' && s.rightsState === 'ALLOWED' && s.publishable === true);
  const reviewedEvidence = evidences.filter((e) => e.reviewState === 'SCHOLAR_REVIEWED' || e.reviewState === 'VERIFIED');
  const unresolvedContradictions = contradictions.filter((c) => c.status !== 'RESOLVED');
  const coverage = claims.length === 0 ? 0 : clamp(reviewedEvidence.length / claims.length);
  const reviewCoverage = evidences.length === 0 ? 0 : clamp(reviewedEvidence.length / evidences.length);
  const contradictionRate = claims.length === 0 ? 0 : clamp(unresolvedContradictions.length / claims.length);
  const rightsCoverage = sources.length === 0 ? 0 : clamp(publicSources.length / sources.length);
  const uncertainty = clamp((1 - coverage + contradictionRate + (1 - rightsCoverage)) / 3);
  const observation = {
    observationId: `obs-${runtime.observations.length + 1}`,
    topic,
    at: new Date().toISOString(),
    counts: { claims: claims.length, evidences: evidences.length, reviewedEvidence: reviewedEvidence.length, contradictions: contradictions.length, unresolvedContradictions: unresolvedContradictions.length, sources: sources.length, publicSources: publicSources.length, gaps: runtime.gaps.size },
    scores: { evidenceCoverage: coverage, reviewCoverage, rightsCoverage, contradictionRate, uncertainty, researchReadiness: clamp((coverage + reviewCoverage + rightsCoverage + (1 - contradictionRate)) / 4) }
  };
  runtime.observations.push(observation);
  record(runtime, 'RESEARCH_OBSERVED', { observationId: observation.observationId, topic });
  return clone(observation);
}

export function deriveKnowledgeGaps(runtime, { topic = null } = {}) {
  const graph = runtime.graphRuntime;
  const claims = graph?.claims ? [...graph.claims.values()] : [];
  const evidences = graph?.evidences ? [...graph.evidences.values()] : [];
  const contradictions = graph?.contradictions ? [...graph.contradictions.values()] : [];
  const created = [];
  if (claims.length > evidences.length) created.push(addKnowledgeGap(runtime, { gapId:`gap-missing-evidence-${runtime.gaps.size + 1}`, topic:topic || 'research', type:'MISSING_EVIDENCE', severity:'HIGH', uncertainty:1 - clamp(evidences.length / claims.length), provenance:{source:'V8_RESEARCH_OBSERVATORY'}}));
  const unresolved = contradictions.filter((c) => c.status !== 'RESOLVED');
  if (unresolved.length) created.push(addKnowledgeGap(runtime, { gapId:`gap-contradiction-${runtime.gaps.size + 1}`, topic:topic || 'research', type:'UNRESOLVED_CONTRADICTION', severity:'HIGH', uncertainty:clamp(unresolved.length / Math.max(1, claims.length)), provenance:{source:'V7_CLAIM_EVIDENCE_CONTRADICTION'}}));
  return created;
}

export function health(runtime) {
  const latest = runtime.observations.at(-1) || observeGraph(runtime);
  return {
    version: runtime.version,
    observations: runtime.observations.length,
    gaps: runtime.gaps.size,
    traces: runtime.traces.length,
    latest: clone(latest)
  };
}

export function createV8ResearchObservatoryStageNodeContract() {
  return Object.freeze({
    stageId: V8_RESEARCH_OBSERVATORY_STAGE_ID,
    version: '1.0',
    capabilities: ['RESEARCH_OBSERVABILITY', 'KNOWLEDGE_GAP_INTELLIGENCE', 'EVIDENCE_COVERAGE_MEASUREMENT', 'UNCERTAINTY_TRACKING'],
    acceptedInputs: ['GRAPH', 'SEARCH_RESULT', 'RESEARCH_OUTPUT'],
    producedOutputs: ['RESEARCH_OBSERVATION', 'KNOWLEDGE_GAP', 'RESEARCH_HEALTH'],
    requiredEvidence: ['PROVENANCE', 'SOURCE_IDENTITY', 'RIGHTS_STATE'],
    rightsPolicy: { defaultState: 'UNKNOWN', unknownIsPublishable: false, restrictedIsPublishable: false },
    reviewPolicy: { scholarlyVerification: true, humanReviewForAuthoritativeUse: true },
    dependencies: ['V7_GRAPH_INTEGRATION'],
    handoffs: ['GRAPH_TO_OBSERVATORY', 'OBSERVATORY_TO_RESEARCH'],
    immutableFields: ['sourceIdentity', 'contentHash', 'originalPdf', 'canonicalQuranArabic']
  });
}
