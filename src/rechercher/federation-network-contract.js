const ALLOWED_STATUS_TRANSITIONS = Object.freeze({
  discovered: new Set(['metadata_verified']),
  metadata_verified: new Set(['rights_verified']),
  rights_verified: new Set(['acquisition_pending']),
  acquisition_pending: new Set(['acquired']),
  acquired: new Set(['integrity_verified']),
  integrity_verified: new Set(['release_backed']),
  release_backed: new Set(['runtime_registered']),
  runtime_registered: new Set(['runtime_active']),
  runtime_active: new Set([]),
});

export const NETWORK_NODE_TYPES = Object.freeze([
  'global-registry', 'country-registry', 'source-federation', 'discovery',
  'provenance', 'rights-gate', 'acquisition', 'verification',
  'release-distribution', 'omega-control-plane', 'execution-plane',
  'offline-distribution', 'canonical-corpus',
]);

export function canTransition(from, to) {
  return Boolean(ALLOWED_STATUS_TRANSITIONS[String(from)]?.has(String(to)));
}

export function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new TypeError(`Invalid federation transition: ${from} -> ${to}`);
  }
  return true;
}

export function normalizeSourceIdentity(source = {}, registry = 'global') {
  if (!source.id) throw new TypeError('SourceIdentity requires id');
  return Object.freeze({
    id: String(source.id),
    name: String(source.name ?? source.id),
    registry: String(registry),
    country: source.country ?? null,
    enabled: source.enabled !== false,
    connectorKind: source.connector?.kind ?? 'web-discovery',
    acquisition: source.acquisition ?? 'metadata-only',
    rightsPolicy: source.rightsPolicy ?? source.rights_policy ?? 'unknown-blocked',
  });
}

export function createFederationEnvelope({
  source,
  registry = 'global',
  status = 'discovered',
  discoveredAt = new Date().toISOString(),
  provenance = {},
  rights = {},
  artifact = null,
} = {}) {
  const sourceIdentity = normalizeSourceIdentity(source, registry);
  if (!ALLOWED_STATUS_TRANSITIONS[status] && status !== 'runtime_active') {
    throw new TypeError(`Unsupported federation status: ${status}`);
  }
  return Object.freeze({
    source: sourceIdentity,
    status,
    provenance: Object.freeze({
      discoveredAt,
      method: provenance.method ?? sourceIdentity.connectorKind,
      sourceUrl: provenance.sourceUrl ?? source.connector?.searchUrl ?? null,
      revision: provenance.revision ?? null,
    }),
    rights: Object.freeze({
      state: rights.state ?? 'unknown',
      evidenceUrl: rights.evidenceUrl ?? null,
      redistributable: rights.redistributable === true,
    }),
    artifact: artifact ? Object.freeze({
      uri: artifact.uri ?? null,
      sha256: artifact.sha256 ?? null,
      releaseTag: artifact.releaseTag ?? null,
    }) : null,
  });
}

export function isReleaseBacked(envelope = {}) {
  return envelope.status === 'release_backed'
    && Boolean(envelope.artifact?.uri)
    && /^[a-f0-9]{64}$/i.test(String(envelope.artifact?.sha256 ?? ''))
    && Boolean(envelope.artifact?.releaseTag);
}
