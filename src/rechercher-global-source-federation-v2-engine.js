const clone = (value) => structuredClone(value);

export const FEDERATION_STATES = Object.freeze(['DISCOVERED','IDENTIFIED','RECONCILED','QUALITY_RANKED','ACQUISITION_READY','DERIVATION_READY']);

export function createSourceFederationEngine({ providers = [] } = {}) {
  return {
    status: 'IMPLEMENTED_FOUNDATION',
    providers: new Map(providers.map((p) => [p.id, clone(p)])),
    works: new Map(),
    manifestations: new Map(),
    attempts: [],
    gaps: [],
    traces: []
  };
}

export function registerFederationProvider(engine, provider) {
  if (!provider?.id) throw new TypeError('provider id is required');
  if (!provider?.engines?.length) throw new TypeError('provider engines are required');
  engine.providers.set(provider.id, clone(provider));
  return clone(provider);
}

export function registerWork(engine, work) {
  if (!work?.workId) throw new TypeError('workId is required');
  if (!work?.sourceIdentity) throw new TypeError('sourceIdentity is required');
  const value = { ...clone(work), state: work.state || 'IDENTIFIED' };
  if (engine.works.has(value.workId) && engine.works.get(value.workId).sourceIdentity !== value.sourceIdentity) {
    throw new Error('immutable source identity conflict');
  }
  engine.works.set(value.workId, value);
  engine.traces.push({ type: 'WORK_REGISTERED', workId: value.workId });
  return clone(value);
}

export function registerManifestation(engine, manifestation) {
  if (!manifestation?.manifestationId) throw new TypeError('manifestationId is required');
  if (!manifestation?.workId) throw new TypeError('workId is required');
  if (!manifestation?.contentHash) throw new TypeError('contentHash is required');
  if (!manifestation?.rightsState) throw new TypeError('rightsState is required');
  if (!engine.works.has(manifestation.workId)) throw new Error('work is not registered');
  const value = { ...clone(manifestation), state: manifestation.state || 'DISCOVERED' };
  const prior = engine.manifestations.get(value.manifestationId);
  if (prior && prior.contentHash !== value.contentHash) throw new Error('immutable content hash conflict');
  engine.manifestations.set(value.manifestationId, value);
  engine.traces.push({ type: 'MANIFESTATION_REGISTERED', manifestationId: value.manifestationId });
  return clone(value);
}

export function rankManifestations(engine, workId) {
  return [...engine.manifestations.values()]
    .filter((m) => m.workId === workId)
    .map((m) => ({ ...clone(m), qualityScore: scoreManifestation(m) }))
    .sort((a, b) => b.qualityScore - a.qualityScore);
}

export function scoreManifestation(m) {
  const factors = [
    ['identityMatch', .20], ['editionMatch', .15], ['completeness', .15],
    ['pageImageQuality', .12], ['pdfIntegrity', .10], ['ocrQuality', .08],
    ['provenanceStrength', .08], ['rightsClarity', .07], ['sourceAuthority', .03],
    ['downloadability', .02]
  ];
  return Math.round(factors.reduce((sum, [k, w]) => sum + Math.max(0, Math.min(1, Number(m[k] ?? 0))) * w, 0) * 1000) / 10;
}

export function buildAcquisitionFallback(engine, workId, failedProviderIds = []) {
  const excluded = new Set(failedProviderIds);
  return [...engine.providers.values()]
    .filter((p) => !excluded.has(p.id))
    .map((p, i) => ({ attempt: i + 1, providerId: p.id, engines: p.engines, mode: 'FALLBACK' }));
}

export function recordAttempt(engine, attempt) {
  if (!attempt?.workId || !attempt?.providerId) throw new TypeError('workId and providerId are required');
  const value = { ...clone(attempt), at: attempt.at || new Date().toISOString() };
  engine.attempts.push(value);
  engine.traces.push({ type: 'ACQUISITION_ATTEMPT', workId: value.workId, providerId: value.providerId, outcome: value.outcome || 'UNKNOWN' });
  return clone(value);
}

export function recordGap(engine, gap) {
  if (!gap?.workId || !gap?.type) throw new TypeError('workId and gap type are required');
  const value = clone(gap);
  engine.gaps.push(value);
  return value;
}

export function bestManifestation(engine, workId) {
  const ranked = rankManifestations(engine, workId).filter((m) => m.publishable !== false && m.rightsState === 'ALLOWED');
  return ranked[0] || null;
}

export function federationHealth(engine) {
  return {
    status: engine.status,
    providers: engine.providers.size,
    works: engine.works.size,
    manifestations: engine.manifestations.size,
    attempts: engine.attempts.length,
    gaps: engine.gaps.length,
    traces: engine.traces.length
  };
}
