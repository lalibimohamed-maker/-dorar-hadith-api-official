export const IDENTITY_STATES = Object.freeze(['DISCOVERED','IDENTIFIED','AMBIGUOUS','DEDUPLICATED','VERIFIED']);

function required(value, name) { if (!value) throw new TypeError(`${name} is required`); }

export function createSourceIdentityEngine() {
  return { sources: new Map(), works: new Map(), identities: new Map(), aliases: new Map() };
}

export function registerSource(engine, { sourceId, provider, locator, workId = null, editionId = null, manifestationId = null, language, contentHash = null, rightsStatus = 'UNKNOWN', retrievedAt = null } = {}) {
  required(sourceId, 'sourceId'); required(provider, 'provider'); required(locator, 'locator'); required(language, 'language');
  if (engine.sources.has(sourceId)) throw new Error(`Duplicate source: ${sourceId}`);
  const source = { sourceId, provider, locator, workId, editionId, manifestationId, language, contentHash, rightsStatus, retrievedAt, identityState: 'DISCOVERED' };
  engine.sources.set(sourceId, structuredClone(source));
  return sourceId;
}

export function resolveIdentity(engine, sourceId, { workId, editionId = null, manifestationId = null, confidence = 0, basis = [] } = {}) {
  required(sourceId, 'sourceId'); required(workId, 'workId');
  if (!engine.sources.has(sourceId)) throw new Error(`Unknown source: ${sourceId}`);
  if (confidence < 0 || confidence > 1) throw new RangeError('confidence must be between 0 and 1');
  const identity = { sourceId, workId, editionId, manifestationId, confidence, basis: [...basis], state: confidence >= 0.9 ? 'VERIFIED' : confidence >= 0.6 ? 'IDENTIFIED' : 'AMBIGUOUS' };
  engine.identities.set(sourceId, identity);
  const source = engine.sources.get(sourceId);
  source.workId = workId; source.editionId = editionId; source.manifestationId = manifestationId; source.identityState = identity.state;
  const work = engine.works.get(workId) || { workId, sourceIds: [] };
  if (!work.sourceIds.includes(sourceId)) work.sourceIds.push(sourceId);
  engine.works.set(workId, work);
  return structuredClone(identity);
}

export function deduplicateSource(engine, sourceId, canonicalSourceId) {
  if (!engine.sources.has(sourceId) || !engine.sources.has(canonicalSourceId)) throw new Error('Unknown source');
  if (sourceId === canonicalSourceId) throw new Error('A source cannot deduplicate to itself');
  engine.aliases.set(sourceId, canonicalSourceId);
  engine.sources.get(sourceId).identityState = 'DEDUPLICATED';
  return canonicalSourceId;
}

export function canonicalSourceId(engine, sourceId) {
  let current = sourceId; const seen = new Set();
  while (engine.aliases.has(current)) { if (seen.has(current)) throw new Error('Deduplication cycle'); seen.add(current); current = engine.aliases.get(current); }
  return current;
}

export function snapshotSourceIdentity(engine) { return structuredClone({ sources: [...engine.sources.values()], works: [...engine.works.values()], identities: [...engine.identities.values()], aliases: [...engine.aliases.entries()] }); }
