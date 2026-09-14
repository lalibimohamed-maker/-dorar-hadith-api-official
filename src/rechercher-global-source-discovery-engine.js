const clone = (value) => structuredClone(value);

export const DISCOVERY_ENGINES = Object.freeze([
  'IIIF_MANIFEST',
  'CANVAS_DISCOVERY',
  'ANNOTATION_DISCOVERY',
  'CONTENT_SEARCH',
  'CHANGE_DISCOVERY',
  'WORK_SEARCH',
  'AUTHOR_SEARCH',
  'SOURCE_SEARCH',
  'CITATION_NEIGHBORHOOD',
  'OPEN_ACCESS_DISCOVERY',
  'DOI_RESOLUTION',
  'LICENSE_DISCOVERY',
  'FULLTEXT_LINK_DISCOVERY',
  'REFERENCE_METADATA',
  'CATALOG_DISCOVERY',
  'API_DISCOVERY'
]);

export function createGlobalSourceDiscoveryEngine({ providers = [] } = {}) {
  return {
    status: 'IMPLEMENTED_EXTENSION_POINT',
    providers: new Map(providers.map((provider) => [provider.id, clone(provider)])),
    candidates: new Map(),
    failures: [],
    traces: []
  };
}

export function registerDiscoveryProvider(engine, provider) {
  if (!provider?.id) throw new TypeError('provider id is required');
  if (!provider?.discovery) throw new TypeError('provider discovery method is required');
  engine.providers.set(provider.id, clone(provider));
  return clone(provider);
}

export function rankProviders(engine, { scope = null, engineName = null } = {}) {
  return [...engine.providers.values()]
    .filter((provider) => !scope || String(provider.scope || '').includes(scope))
    .filter((provider) => !engineName || (provider.engines || []).includes(engineName) || provider.discovery === engineName)
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))
    .map(clone);
}

export function recordCandidate(engine, candidate) {
  if (!candidate?.candidateId) throw new TypeError('candidateId is required');
  if (!candidate?.providerId) throw new TypeError('providerId is required');
  if (!engine.providers.has(candidate.providerId)) throw new Error('provider not registered');
  const value = { ...clone(candidate), state: candidate.state || 'DISCOVERED' };
  engine.candidates.set(value.candidateId, value);
  engine.traces.push({ type: 'CANDIDATE_DISCOVERED', candidateId: value.candidateId, providerId: value.providerId });
  return clone(value);
}

export function recordProviderFailure(engine, { providerId, query, reason, recoverable = true } = {}) {
  if (!engine.providers.has(providerId)) throw new Error('provider not registered');
  const failure = { providerId, query: query || null, reason: reason || 'UNKNOWN', recoverable: Boolean(recoverable), at: new Date().toISOString() };
  engine.failures.push(failure);
  engine.traces.push({ type: 'PROVIDER_FAILURE', ...failure });
  return clone(failure);
}

export function buildFallbackPlan(engine, { scope = null, engineName = null, excludeProviderIds = [] } = {}) {
  const excluded = new Set(excludeProviderIds);
  return rankProviders(engine, { scope, engineName }).filter((provider) => !excluded.has(provider.id)).map((provider, index) => ({
    attempt: index + 1,
    providerId: provider.id,
    discovery: provider.discovery,
    download: provider.download || 'SOURCE_DEPENDENT',
    rights: provider.rights || 'SOURCE_RECORD'
  }));
}

export function bestCandidate(engine, candidates = []) {
  const verified = candidates.filter((candidate) => candidate && candidate.verified && candidate.publishable !== false);
  return verified.sort((a, b) => Number(b.qualityScore || 0) - Number(a.qualityScore || 0))[0] || null;
}

export function discoveryHealth(engine) {
  return {
    status: engine.status,
    providers: engine.providers.size,
    candidates: engine.candidates.size,
    failures: engine.failures.length,
    traces: engine.traces.length
  };
}
