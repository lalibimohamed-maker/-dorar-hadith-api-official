import { SEARCH_STAGES, registerSearch, recordSearchResult, advanceSearchStage, publishableResults } from './rechercher-global-knowledge-search-engine.js';
import { createResearchFoundationEngine, publishableSource } from './rechercher-v5-research-foundation-engine.js';
import { createCognitiveLearningEngine, startCognitiveSession, processCognitiveAttempt, buildCognitivePlan, selectKnowledgeGapAction } from './rechercher-cognitive-learning-engine.js';

export const NETWORK_STAGES = Object.freeze([
  'V1_FOUNDATION',
  'V2_FEDERATION',
  'V3_DOMAIN_LEARNING',
  'V4_LEARNING_INTELLIGENCE',
  'V5_GLOBAL_RESEARCH'
]);

export const HANDOFFS = Object.freeze([
  'DISCOVERY_TO_IDENTITY',
  'IDENTITY_TO_PROVENANCE',
  'PROVENANCE_TO_RIGHTS',
  'RIGHTS_TO_EVIDENCE',
  'EVIDENCE_TO_LEARNING',
  'LEARNING_TO_RESEARCH',
  'RESEARCH_TO_REPLAN'
]);

const STAGE_ORDER = new Map(NETWORK_STAGES.map((stage, index) => [stage, index]));

function requireId(value, name) {
  if (!value) throw new TypeError(`${name} is required`);
}

function clone(value) {
  return structuredClone(value);
}

export function createFiveStageNetwork({
  search = {},
  foundation = createResearchFoundationEngine(),
  cognitive = createCognitiveLearningEngine(),
  federation = null,
  domain = null,
  learningIntelligence = null,
  observability = null
} = {}) {
  return {
    search,
    foundation,
    cognitive,
    federation,
    domain,
    learningIntelligence,
    observability,
    state: 'V1_FOUNDATION',
    handoffs: [],
    traces: [],
    gaps: [],
    outputs: new Map()
  };
}

export function registerNetworkQuery(network, query) {
  requireId(query?.queryId, 'queryId');
  const engine = network.search;
  registerSearch(engine, query);
  network.traces.push({ type: 'QUERY_REGISTERED', queryId: query.queryId, stage: 'V1_FOUNDATION' });
  return clone(engine.queries.get(query.queryId));
}

export function registerNetworkResult(network, result) {
  const value = recordSearchResult(network.search, result);
  network.traces.push({ type: 'RESULT_REGISTERED', resultId: value.resultId, queryId: value.queryId, sourceId: value.sourceId });
  return value;
}

export function advanceNetworkSearch(network, queryId, stage) {
  const value = advanceSearchStage(network.search, queryId, stage);
  network.traces.push({ type: 'SEARCH_STAGE', queryId, stage: value });
  return value;
}

export function verifyNetworkSource(network, { sourceId, identityState = 'VERIFIED', rightsState = 'UNKNOWN', provenanceVerified = false, reviewerRole = null } = {}) {
  requireId(sourceId, 'sourceId');
  const source = network.foundation.sources.get(sourceId);
  if (!source) throw new Error('source not registered');
  source.provenanceVerified = Boolean(provenanceVerified);
  source.identityState = identityState;
  if (rightsState !== 'UNKNOWN') {
    const { setRights } = network.__foundationApi;
    setRights(network.foundation, sourceId, rightsState, source.permissionEvidence ?? null);
  }
  source.identityReviewerRole = reviewerRole;
  network.traces.push({ type: 'SOURCE_VERIFIED', sourceId, identityState, rightsState, reviewerRole });
  return clone(source);
}

export function connectHandoff(network, from, to, payload = {}) {
  const fromIndex = STAGE_ORDER.get(from);
  const toIndex = STAGE_ORDER.get(to);
  if (fromIndex === undefined || toIndex === undefined) throw new RangeError('unknown network stage');
  if (toIndex < fromIndex) throw new RangeError('network stage cannot move backwards');
  const handoff = { id: `handoff-${network.handoffs.length + 1}`, from, to, payload: clone(payload) };
  network.handoffs.push(handoff);
  network.state = to;
  network.traces.push({ type: 'HANDOFF', ...handoff });
  return clone(handoff);
}

export function startNetworkLearning(network, { sessionId, learnerId, itemId, sourceIds = [] } = {}) {
  const session = startCognitiveSession(network.cognitive, { sessionId, learnerId, itemId, sourceIds });
  connectHandoff(network, 'V3_DOMAIN_LEARNING', 'V4_LEARNING_INTELLIGENCE', { sessionId, sourceIds });
  return clone(session);
}

export function processNetworkAttempt(network, sessionId, attempt, options = {}) {
  const result = processCognitiveAttempt(network.cognitive, sessionId, attempt, options);
  const gapAction = selectKnowledgeGapAction({
    needsSource: result.decision?.sourceIds?.length === 0,
    lowRetrieval: result.diagnosis?.retrievalFailure === true,
    lowTransfer: result.diagnosis?.transferFailure === true,
    overload: result.diagnosis?.overload === true,
    needsReflection: result.diagnosis?.needsReflection === true
  });
  const output = { ...result, gapAction };
  network.gaps.push({ sessionId, gapAction, at: new Date().toISOString() });
  network.outputs.set(sessionId, output);
  network.traces.push({ type: 'LEARNING_FEEDBACK', sessionId, gapAction });
  connectHandoff(network, 'V4_LEARNING_INTELLIGENCE', 'V5_GLOBAL_RESEARCH', { sessionId, gapAction });
  return clone(output);
}

export function buildNetworkPlan(network, options = {}) {
  const plan = buildCognitivePlan(network.cognitive, options);
  const publishable = options.queryId ? publishableResults(network.search, options.queryId) : [];
  const sourceIds = options.sourceIds ?? [];
  const rights = sourceIds.map(sourceId => ({ sourceId, publishable: publishableSource(network.foundation, sourceId) }));
  const output = { plan, publishableResults: publishable, sourceRights: rights, networkStage: network.state };
  network.outputs.set(`plan:${options.learnerId ?? 'unknown'}:${options.conceptId ?? 'unknown'}`, output);
  network.traces.push({ type: 'NETWORK_PLAN_BUILT', learnerId: options.learnerId, conceptId: options.conceptId, sourceIds });
  return clone(output);
}

export function networkHealth(network) {
  const verifiedSources = [...network.foundation.sources.values()].filter(source => source.provenanceVerified).length;
  const allowedSources = [...network.foundation.sources.keys()].filter(sourceId => publishableSource(network.foundation, sourceId)).length;
  return {
    state: network.state,
    searches: network.search.queries?.size ?? 0,
    results: network.search.results?.size ?? 0,
    verifiedSources,
    allowedSources,
    handoffs: network.handoffs.length,
    traces: network.traces.length,
    gaps: network.gaps.length,
    searchStages: [...SEARCH_STAGES]
  };
}

export function assertNetworkContract(network) {
  const health = networkHealth(network);
  if (health.state !== 'V5_GLOBAL_RESEARCH') throw new Error('five-stage network has not reached V5');
  if (health.handoffs === 0) throw new Error('no stage handoffs recorded');
  return health;
}

// Injected only to keep the network adapter testable while the V2/V3/V4 engines evolve independently.
export function attachFoundationApi(network, api) {
  if (!api?.setRights) throw new TypeError('setRights API is required');
  network.__foundationApi = api;
  return network;
}
