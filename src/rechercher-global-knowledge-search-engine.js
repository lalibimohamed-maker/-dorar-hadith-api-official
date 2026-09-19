export const SEARCH_STAGES = Object.freeze(['DISCOVERY','IDENTITY','PROVENANCE','RIGHTS','EVIDENCE','SYNTHESIS']);

export function createGlobalKnowledgeSearchEngine({ sourceFederation, identity, evidence } = {}) {
  return { sourceFederation, identity, evidence, queries: new Map(), results: new Map() };
}

export function registerSearch(engine, { queryId, text, language = 'ar', domains = [], at = null } = {}) {
  if (!queryId || !text) throw new TypeError('queryId and text are required');
  engine.queries.set(queryId, { queryId, text, language, domains: [...domains], at, stage: 'DISCOVERY' }); return queryId;
}

export function recordSearchResult(engine, { queryId, resultId, sourceId, identityState = 'DISCOVERED', rightsStatus = 'UNKNOWN', evidenceState = 'AI_GENERATED', provenance = null } = {}) {
  if (!engine.queries.has(queryId)) throw new Error('Unknown query');
  if (!resultId || !sourceId) throw new TypeError('resultId and sourceId are required');
  const result = { resultId, queryId, sourceId, identityState, rightsStatus, evidenceState, provenance, publishable: identityState === 'VERIFIED' && rightsStatus === 'ALLOWED' && evidenceState !== 'AI_GENERATED' };
  engine.results.set(resultId, result); return structuredClone(result);
}

export function advanceSearchStage(engine, queryId, stage) {
  if (!engine.queries.has(queryId)) throw new Error('Unknown query');
  if (!SEARCH_STAGES.includes(stage)) throw new TypeError('Invalid search stage');
  const query = engine.queries.get(queryId); query.stage = stage;
  return query.stage;
}

export function publishableResults(engine, queryId) {
  return [...engine.results.values()].filter(r => r.queryId === queryId && r.publishable).map(r => structuredClone(r));
}
