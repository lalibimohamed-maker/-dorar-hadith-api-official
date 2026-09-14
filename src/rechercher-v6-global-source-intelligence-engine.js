import { createStageNodeContract } from './rechercher-stage-node-contract.js';

export const V6_STAGE_ID = 'V6_GLOBAL_SOURCE_INTELLIGENCE';
export const V6_SOURCE_STATES = Object.freeze(['SOURCE_CANDIDATE', 'IDENTITY_RESOLVED', 'VERIFIED_SOURCE']);
export const V6_RIGHTS_STATES = Object.freeze(['ALLOWED', 'RESTRICTED', 'UNKNOWN', 'EXPLICIT_PERMISSION_REQUIRED']);

const IMMUTABLE_FIELDS = Object.freeze(['sourceIdentity', 'contentHash', 'canonicalQuranArabic', 'originalPdf']);

function clone(value) {
  return structuredClone(value);
}

function requireId(value, name) {
  if (!value) throw new TypeError(`${name} is required`);
}

function assertRightsState(state) {
  if (!V6_RIGHTS_STATES.includes(state)) throw new TypeError(`invalid rights state: ${state}`);
}

function assertImmutablePreserved(before, after) {
  for (const field of IMMUTABLE_FIELDS) {
    if (JSON.stringify(before?.[field]) !== JSON.stringify(after?.[field])) {
      throw new Error(`V6 cannot mutate immutable field: ${field}`);
    }
  }
}

export function createV6StageNodeContract() {
  return createStageNodeContract({
    stageId: V6_STAGE_ID,
    version: '1.0',
    capabilities: [
      'GLOBAL_SOURCE_DISCOVERY',
      'SOURCE_CLASSIFICATION',
      'SOURCE_IDENTITY_RESOLUTION',
      'SOURCE_DEDUPLICATION',
      'PROVENANCE_VALIDATION',
      'RIGHTS_EVALUATION',
      'WORK_EDITION_MANUSCRIPT_LINKING'
    ],
    acceptedInputs: [
      { type: 'RESEARCH_OUTPUT' },
      { type: 'SOURCE_CANDIDATE' }
    ],
    producedOutputs: [
      { type: 'SOURCE_CANDIDATE' },
      { type: 'VERIFIED_SOURCE' }
    ],
    requiredEvidence: [
      { type: 'SOURCE_IDENTITY' },
      { type: 'PROVENANCE' },
      { type: 'RIGHTS_STATE' }
    ],
    rightsPolicy: {
      defaultState: 'UNKNOWN',
      publishableState: 'ALLOWED',
      unknownIsPublishable: false,
      restrictedIsPublishable: false
    },
    reviewPolicy: {
      scholarlyVerification: true,
      humanReviewForAuthoritativeUse: true
    },
    dependencies: ['V5_GLOBAL_RESEARCH'],
    handoffs: ['RESEARCH_TO_SOURCE_INTELLIGENCE', 'SOURCE_INTELLIGENCE_TO_EVIDENCE'],
    tracePolicy: { traceIdRequired: true },
    status: 'OPEN_EXTENSION_POINT'
  });
}

export function createV6GlobalSourceIntelligenceEngine({ observability = null } = {}) {
  return {
    stageId: V6_STAGE_ID,
    status: 'FOUNDATION_IMPLEMENTED_EXTENSION_POINT',
    candidates: new Map(),
    sources: new Map(),
    links: [],
    traces: [],
    observability
  };
}

export function discoverSource(engine, candidate) {
  requireId(candidate?.candidateId, 'candidateId');
  requireId(candidate?.sourceUrl, 'sourceUrl');
  const record = {
    state: 'SOURCE_CANDIDATE',
    candidateId: candidate.candidateId,
    sourceUrl: candidate.sourceUrl,
    sourceType: candidate.sourceType || 'WEB',
    institution: candidate.institution || null,
    language: candidate.language || null,
    discoveredAt: candidate.discoveredAt || new Date().toISOString(),
    provenance: clone(candidate.provenance || null),
    rightsState: candidate.rightsState || 'UNKNOWN',
    ...clone(candidate)
  };
  assertRightsState(record.rightsState);
  engine.candidates.set(record.candidateId, clone(record));
  recordTrace(engine, 'SOURCE_CANDIDATE_DISCOVERED', { candidateId: record.candidateId });
  return clone(record);
}

export function classifySource(engine, candidateId, classification = {}) {
  const candidate = engine.candidates.get(candidateId);
  if (!candidate) throw new Error('source candidate not found');
  const updated = { ...clone(candidate), classification: clone(classification) };
  assertImmutablePreserved(candidate, updated);
  engine.candidates.set(candidateId, updated);
  recordTrace(engine, 'SOURCE_CLASSIFIED', { candidateId, classification });
  return clone(updated);
}

export function resolveSourceIdentity(engine, candidateId, identity) {
  const candidate = engine.candidates.get(candidateId);
  if (!candidate) throw new Error('source candidate not found');
  requireId(identity?.sourceId, 'sourceId');
  const updated = {
    ...clone(candidate),
    sourceIdentity: clone(identity),
    sourceId: identity.sourceId,
    identityState: 'VERIFIED',
    state: 'IDENTITY_RESOLVED'
  };
  assertImmutablePreserved(candidate, updated);
  engine.candidates.set(candidateId, updated);
  recordTrace(engine, 'SOURCE_IDENTITY_RESOLVED', { candidateId, sourceId: identity.sourceId });
  return clone(updated);
}

export function deduplicateSource(engine, candidateId) {
  const candidate = engine.candidates.get(candidateId);
  if (!candidate) throw new Error('source candidate not found');
  const identityKey = candidate.sourceId || candidate.sourceUrl;
  const duplicate = [...engine.sources.values()].find(source =>
    source.sourceId === identityKey ||
    (candidate.contentHash && source.contentHash === candidate.contentHash) ||
    (candidate.sourceUrl && source.sourceUrl === candidate.sourceUrl)
  );
  if (duplicate) {
    recordTrace(engine, 'SOURCE_DEDUPLICATED', { candidateId, canonicalSourceId: duplicate.sourceId });
    return { duplicate: true, canonicalSource: clone(duplicate) };
  }
  return { duplicate: false, canonicalSource: null };
}

export function evaluateRights(engine, candidateId, rightsState, evidence = null) {
  const candidate = engine.candidates.get(candidateId);
  if (!candidate) throw new Error('source candidate not found');
  assertRightsState(rightsState);
  const updated = { ...clone(candidate), rightsState, rightsEvidence: clone(evidence) };
  assertImmutablePreserved(candidate, updated);
  engine.candidates.set(candidateId, updated);
  recordTrace(engine, 'SOURCE_RIGHTS_EVALUATED', { candidateId, rightsState });
  return clone(updated);
}

export function verifySource(engine, candidateId) {
  const candidate = engine.candidates.get(candidateId);
  if (!candidate) throw new Error('source candidate not found');
  if (candidate.identityState !== 'VERIFIED') throw new Error('source identity must be verified');
  if (!candidate.provenance) throw new Error('provenance evidence is required');
  if (!candidate.sourceId) throw new Error('sourceId is required');
  const duplicate = deduplicateSource(engine, candidateId);
  if (duplicate.duplicate) return duplicate.canonicalSource;
  const verified = {
    ...clone(candidate),
    state: 'VERIFIED_SOURCE',
    verifiedAt: new Date().toISOString(),
    publishable: candidate.rightsState === 'ALLOWED'
  };
  assertImmutablePreserved(candidate, verified);
  engine.sources.set(verified.sourceId, clone(verified));
  recordTrace(engine, 'SOURCE_VERIFIED', {
    candidateId,
    sourceId: verified.sourceId,
    publishable: verified.publishable,
    rightsState: verified.rightsState
  });
  return clone(verified);
}

export function linkSourceToWorkEditionManuscript(engine, sourceId, { workId = null, editionId = null, manuscriptId = null } = {}) {
  const source = engine.sources.get(sourceId);
  if (!source) throw new Error('verified source not found');
  const link = { sourceId, workId, editionId, manuscriptId, at: new Date().toISOString() };
  engine.links.push(link);
  recordTrace(engine, 'SOURCE_LINKED', link);
  return clone(link);
}

export function isPublishableSource(source) {
  return source?.state === 'VERIFIED_SOURCE' && source?.rightsState === 'ALLOWED' && source?.publishable === true;
}

export function recordTrace(engine, type, payload = {}, traceId = null) {
  const id = traceId || `rechercher-v6-trace-${engine.traces.length + 1}`;
  const event = { traceId: id, type, at: new Date().toISOString(), ...clone(payload) };
  engine.traces.push(event);
  if (engine.observability?.record) engine.observability.record(event);
  return id;
}

export function v6Health(engine) {
  return {
    stageId: engine.stageId,
    status: engine.status,
    candidates: engine.candidates.size,
    verifiedSources: engine.sources.size,
    links: engine.links.length,
    traces: engine.traces.length
  };
}
