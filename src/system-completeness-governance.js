/**
 * Din Allah Encyclopedia — System Completeness Governance 2026.
 *
 * Contract layer only: it governs how technical/automated layers may sit above
 * the scientific Corpus. It does not rewrite Corpus content or silently elevate
 * discovery results into evidence.
 */

export const SYSTEM_DOMAINS = Object.freeze([
  'ontology',
  'claims-and-evidence',
  'lineage',
  'interoperability',
  'accessibility',
  'language-awareness',
  'resilience',
  'integrity',
  'quarantine-and-review',
  'rights-and-sustainability'
]);

export const TRUTH_LAYERS = Object.freeze([
  'original_text',
  'source_metadata',
  'scholarly_ruling',
  'scholarly_explanation',
  'analysis_inference',
  'translation',
  'learning_output'
]);

export const DISCOVERY_STATES = Object.freeze([
  'candidate',
  'source_verified',
  'provenance_verified',
  'rights_verified',
  'independently_validated',
  'review_ready',
  'accepted'
]);

export const EXTERNAL_STANDARDS = Object.freeze({
  dcmi: { name: 'DCMI', purpose: 'resource-metadata-rights-identifiers', scientificAuthority: false },
  iiif: { name: 'IIIF', purpose: 'compound-digital-objects-and-images', scientificAuthority: false },
  webAnnotation: { name: 'W3C Web Annotation', purpose: 'precise-annotations', scientificAuthority: false },
  roCrate: { name: 'RO-Crate', purpose: 'packaging-and-provenance', scientificAuthority: false },
  premis: { name: 'PREMIS', purpose: 'digital-preservation-events-rights', scientificAuthority: false },
  wcag22aa: { name: 'WCAG 2.2 AA', purpose: 'accessibility-target', scientificAuthority: false },
  traceContext: { name: 'W3C Trace Context', purpose: 'distributed-observability', scientificAuthority: false }
});

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function unique(values) {
  return [...new Set(values)];
}

function hasSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function rightsKnownAndAllowed(rights = {}) {
  return ['redistributable', 'licensed', 'public-domain'].includes(rights.status);
}

function sourcePacketComplete(packet = {}) {
  return nonEmpty(packet.sourceId) &&
    nonEmpty(packet.resourceId) &&
    nonEmpty(packet.url) &&
    nonEmpty(packet.citation) &&
    nonEmpty(packet.verifiedAt) &&
    hasSha256(packet.contentSha256) &&
    rightsKnownAndAllowed(packet.rights);
}

export function registerOntologyField({ id, label, parent = null, corpusOwned = true } = {}) {
  if (!nonEmpty(id) || !nonEmpty(label)) throw new TypeError('ontology field id and label are required');
  return Object.freeze({
    id, label, parent, corpusOwned: corpusOwned === true,
    mutationPolicy: corpusOwned ? 'governed-corpus-write-only' : 'system-layer-only'
  });
}

export function evaluateDiscoveryCandidate(candidate = {}) {
  const failures = [];
  if (!sourcePacketComplete(candidate)) failures.push('source_provenance_rights_validation_incomplete');
  if (candidate.independentValidation !== true) failures.push('independent_validation_required');
  if (candidate.reviewRequired !== false && candidate.humanReview !== true) failures.push('human_review_required');
  if (candidate.discoveryOnly === true) failures.push('discovery_is_not_evidence');

  return Object.freeze({
    accepted: failures.length === 0,
    state: failures.length === 0 ? 'accepted' : 'candidate',
    failures,
    discoveryIsEvidence: false,
    corpusMutation: false
  });
}

export function createClaimRecord({
  id,
  statement,
  evidenceIds = [],
  supportingEvidenceIds = [],
  opposingEvidenceIds = [],
  disputed = false,
  uncertainty = null,
  truthLayer = 'analysis_inference'
} = {}) {
  if (!nonEmpty(id) || !nonEmpty(statement)) throw new TypeError('claim id and statement are required');
  if (!TRUTH_LAYERS.includes(truthLayer)) throw new TypeError('invalid truth layer');
  const evidence = unique([...evidenceIds, ...supportingEvidenceIds, ...opposingEvidenceIds]);
  if (!evidence.length) throw new TypeError('claim requires evidence references');
  return Object.freeze({
    id, statement, truthLayer,
    evidenceIds: evidence,
    supportingEvidenceIds: unique(supportingEvidenceIds),
    opposingEvidenceIds: unique(opposingEvidenceIds),
    disputed: disputed === true,
    uncertainty,
    generatedAssistance: truthLayer === 'learning_output' || truthLayer === 'analysis_inference',
    canonical: truthLayer === 'original_text',
    corpusMutation: false
  });
}

export function createLineageRecord({
  derivedId,
  parentIds = [],
  transformation,
  independentVerification = false
} = {}) {
  if (!nonEmpty(derivedId) || !nonEmpty(transformation) || !parentIds.length) {
    throw new TypeError('lineage requires derived id, parent ids and transformation');
  }
  return Object.freeze({
    derivedId,
    parentIds: unique(parentIds),
    transformation,
    independentVerification: independentVerification === true,
    preservesHistoricalParent: true,
    canonicalReplacement: false
  });
}

export function reconcileCandidates({ candidates = [] } = {}) {
  const uniqueByFingerprint = new Map();
  const conflicts = [];
  for (const candidate of candidates) {
    const key = candidate.fingerprint || candidate.resourceId || candidate.id;
    if (!nonEmpty(key)) continue;
    if (uniqueByFingerprint.has(key)) {
      uniqueByFingerprint.get(key).duplicates.push(candidate.id || candidate.resourceId);
      continue;
    }
    uniqueByFingerprint.set(key, {
      canonicalCandidateId: candidate.id || candidate.resourceId,
      duplicates: []
    });
  }

  const byField = new Map();
  for (const candidate of candidates) {
    for (const [field, value] of Object.entries(candidate.claims || {})) {
      const values = byField.get(field) || new Map();
      const normalized = JSON.stringify(value);
      values.set(normalized, (values.get(normalized) || 0) + 1);
      byField.set(field, values);
    }
  }
  for (const [field, values] of byField) {
    if (values.size > 1) conflicts.push({ field, variants: [...values.keys()] });
  }

  return Object.freeze({
    duplicates: [...uniqueByFingerprint.values()].filter((x) => x.duplicates.length),
    conflicts,
    requiresHumanReview: conflicts.length > 0
  });
}

export function createHistoricalChangeRecord({
  originalId,
  event,
  successorId = null,
  reason,
  occurredAt
} = {}) {
  if (!nonEmpty(originalId) || !['withdrawn', 'replaced', 'superseded', 'corrected'].includes(event)) {
    throw new TypeError('invalid historical change');
  }
  if (!nonEmpty(reason) || !nonEmpty(occurredAt)) throw new TypeError('change reason and time are required');
  return Object.freeze({
    originalId,
    event,
    successorId,
    reason,
    occurredAt,
    eraseHistoricalRecord: false
  });
}

export function createContributionEntry({
  contributorId,
  targetId,
  payload,
  stage = 'quarantine',
  reviewerId = null
} = {}) {
  if (!nonEmpty(contributorId) || !nonEmpty(targetId)) {
    throw new TypeError('contributor and target are required');
  }
  const acceptedStages = ['quarantine', 'review', 'accepted'];
  if (!acceptedStages.includes(stage)) throw new TypeError('invalid contribution stage');
  if (stage === 'accepted' && !nonEmpty(reviewerId)) {
    throw new TypeError('accepted contribution requires reviewer');
  }
  return Object.freeze({
    contributorId,
    targetId,
    payload: payload ?? null,
    stage,
    reviewerId,
    directSourceMutation: false,
    originalSourceMutation: false
  });
}

export function createResiliencePolicy({
  offlineAvailable = false,
  backupDefined = false,
  restoreTested = false,
  distributedMonitoring = false,
  safeDegrade = false
} = {}) {
  return Object.freeze({
    offlineAvailable: offlineAvailable === true,
    backupDefined: backupDefined === true,
    restoreTested: restoreTested === true,
    distributedMonitoring: distributedMonitoring === true,
    safeDegrade: safeDegrade === true,
    productionReady: [offlineAvailable, backupDefined, restoreTested, distributedMonitoring, safeDegrade]
      .every((value) => value === true)
  });
}

export function createEngineRequirement({
  capability,
  availableEngines = [],
  preferredCount = 3
} = {}) {
  if (!nonEmpty(capability)) throw new TypeError('capability is required');
  const uniqueEngines = unique(availableEngines.filter(nonEmpty));
  return Object.freeze({
    capability,
    minimumEngineCount: 2,
    preferredEngineCount: Math.max(3, preferredCount),
    availableEngineCount: uniqueEngines.length,
    satisfiesMinimum: uniqueEngines.length >= 2,
    preferredSatisfied: uniqueEngines.length >= Math.max(3, preferredCount),
    engines: uniqueEngines,
    singleEngineApprovalAllowed: false
  });
}

export function buildExternalStandardsProfile() {
  return structuredClone(EXTERNAL_STANDARDS);
}

export function systemCompletenessPolicy() {
  return Object.freeze({
    humanLedAiAssistedOpenSource: true,
    technicalLayersAboveCorpus: true,
    silentCorpusReplacement: false,
    discoveryIsEvidence: false,
    claimRequiresEvidence: true,
    disputedClaimsNeedExplicitState: true,
    lineageRequiredForDerivedContent: true,
    minimumIndependentEngines: 2,
    preferredIndependentEngines: 3,
    externalStandardsAreScientificSources: false,
    wcagTarget: '2.2-AA',
    offlineAndRestoreMustBeTestable: true,
    contributionsStartInQuarantine: true,
    originalSourceDirectMutationByPublicContributors: false,
    rightsRequiredForRedistribution: true,
    freeDoesNotMeanPublicDomain: true
  });
}
