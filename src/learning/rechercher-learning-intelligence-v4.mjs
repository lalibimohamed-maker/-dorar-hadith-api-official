import { createHash } from 'node:crypto';

export const V4_VERSION = '4.0.0';

export const MEMORY_TYPES = Object.freeze([
  'session',
  'long_term'
]);

export const TRANSFER_STATUSES = Object.freeze([
  'candidate',
  'evidence_supported',
  'needs_review',
  'completed'
]);

export const PEDAGOGICAL_SAFETY_STATES = Object.freeze([
  'source_grounded',
  'retrieval_preserved',
  'uncertainty_explicit',
  'human_review_required',
  'unsafe_for_autonomous_authority'
]);

export const DEFAULT_FEEDBACK_BUFFER_LIMIT = 32;

const clamp = (n, lo = 0, hi = 1) =>
  Math.max(lo, Math.min(hi, Number.isFinite(Number(n)) ? Number(n) : 0));

const hash = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function unique(values) {
  return [...new Set(values)];
}

export function createSessionMemory(input = {}) {
  return {
    type: 'session',
    version: 4,
    learnerId: input.learnerId || null,
    sessionId: requireText(input.sessionId, 'sessionId'),
    startedAt: input.startedAt || null,
    events: Array.isArray(input.events) ? [...input.events] : [],
    feedbackBuffer: Array.isArray(input.feedbackBuffer) ? input.feedbackBuffer.slice(-DEFAULT_FEEDBACK_BUFFER_LIMIT) : [],
    retrievalEffort: clamp(input.retrievalEffort ?? 0),
    sourceIds: unique(input.sourceIds || []),
    durablePersistencePrepared: false
  };
}

export function appendSessionEvent(memory, event) {
  const next = {
    ...memory,
    events: [...(memory?.events || []), { ...event }]
  };
  return next;
}

export function appendFeedback(memory, feedback, limit = DEFAULT_FEEDBACK_BUFFER_LIMIT) {
  const boundedLimit = Math.max(1, Math.floor(Number(limit) || DEFAULT_FEEDBACK_BUFFER_LIMIT));
  const buffer = [...(memory?.feedbackBuffer || []), { ...feedback }];
  return {
    ...memory,
    feedbackBuffer: buffer.slice(-boundedLimit)
  };
}

export function summarizeSession(memory) {
  if (!memory || memory.type !== 'session') {
    throw new Error('session memory required');
  }

  const events = Array.isArray(memory.events) ? memory.events : [];
  const feedback = Array.isArray(memory.feedbackBuffer) ? memory.feedbackBuffer : [];
  const summary = {
    type: 'session_summary',
    sessionId: memory.sessionId,
    learnerId: memory.learnerId,
    eventCount: events.length,
    sourceIds: unique([
      ...(memory.sourceIds || []),
      ...events.flatMap((event) => event.sourceIds || []),
      ...feedback.flatMap((item) => item.sourceIds || [])
    ]),
    attemptedSkills: unique(events.map((event) => event.skillId).filter(Boolean)),
    errors: events.filter((event) => event.correct === false).length,
    successes: events.filter((event) => event.correct === true).length,
    retrievalEffort: clamp(memory.retrievalEffort),
    feedbackSignals: feedback.map((item) => ({
      kind: item.kind || 'unspecified',
      accepted: item.accepted === true,
      sourceGrounded: item.sourceGrounded === true
    })),
    generatedAt: new Date().toISOString(),
  };

  return Object.freeze({
    ...summary,
    summaryHash: hash(summary)
  });
}

export function persistLongTermMemory(existing = {}, sessionSummary, options = {}) {
  if (!sessionSummary || sessionSummary.type !== 'session_summary') {
    throw new Error('session summary required');
  }

  const prior = existing || {};
  const entries = Array.isArray(prior.entries) ? [...prior.entries] : [];
  const retention = Math.max(1, Math.floor(Number(options.maxEntries) || 100));
  const entry = {
    ...sessionSummary,
    persistedAt: new Date().toISOString()
  };

  return Object.freeze({
    type: 'long_term',
    learnerId: prior.learnerId || sessionSummary.learnerId || null,
    version: 4,
    entries: [...entries, entry].slice(-retention),
    sessionSummariesOnly: true,
    rawSessionEventsPersisted: false,
    rawFeedbackPersisted: false,
    retentionLimit: retention
  });
}

export function createTransferRoute({
  id,
  sourceSkillId,
  targetSkillId,
  relation = 'transfer_to',
  sourceEvidenceIds = [],
  targetEvidenceIds = [],
  status = 'candidate'
} = {}) {
  requireText(id, 'id');
  requireText(sourceSkillId, 'sourceSkillId');
  requireText(targetSkillId, 'targetSkillId');

  if (!TRANSFER_STATUSES.includes(status)) {
    throw new Error('invalid transfer status');
  }

  return Object.freeze({
    id,
    sourceSkillId,
    targetSkillId,
    relation,
    sourceEvidenceIds: unique(sourceEvidenceIds),
    targetEvidenceIds: unique(targetEvidenceIds),
    status,
    explicit: true,
    sameSkillAssumption: false
  });
}

export function evaluateTransferRoute(route = {}, evidence = []) {
  if (!route?.sourceSkillId || !route?.targetSkillId) {
    throw new Error('transfer route requires source and target skills');
  }

  const supported = evidence.filter((item) =>
    item?.verified === true &&
    item?.provenanceId &&
    (item.skillId === route.sourceSkillId || item.skillId === route.targetSkillId)
  );

  if (supported.length < 2) {
    return Object.freeze({
      status: 'needs_review',
      supportedEvidence: supported.length,
      route: { ...route, status: 'needs_review' }
    });
  }

  return Object.freeze({
    status: 'evidence_supported',
    supportedEvidence: supported.length,
    route: { ...route, status: 'evidence_supported' }
  });
}

export function createLongTermLearnerProfile(input = {}) {
  return Object.freeze({
    learnerId: input.learnerId || null,
    mastery: { ...(input.mastery || {}) },
    prerequisites: { ...(input.prerequisites || {}) },
    retrievalStrength: { ...(input.retrievalStrength || {}) },
    recentErrors: Array.isArray(input.recentErrors) ? [...input.recentErrors] : [],
    confidence: { ...(input.confidence || {}) },
    learningHistory: Array.isArray(input.learningHistory) ? [...input.learningHistory] : [],
    sourceProgress: { ...(input.sourceProgress || {}) },
    preferredModality: input.preferredModality || null,
    sessionSummaryCount: Number(input.sessionSummaryCount || 0),
    rawSessionData: false,
    rawFeedbackData: false
  });
}

export function chooseLearningAction({
  retrievalEffort = 0,
  shouldPreserveRetrieval = false,
  requestedDirectAnswer = false,
  evidenceAvailable = true,
  preferredModality = null,
  scaffold = null
} = {}) {
  const effort = clamp(retrievalEffort);
  const preserve = shouldPreserveRetrieval === true && effort > 0;
  const answerMode =
    !evidenceAvailable ? 'withhold-and-request-evidence' :
    preserve && requestedDirectAnswer ? 'guided-retrieval-first' :
    requestedDirectAnswer ? 'direct-answer-with-evidence' :
    'guided-practice';

  return Object.freeze({
    answerMode,
    retrievalPreserved: preserve,
    preferredModality,
    scaffold,
    sourceGrounded: evidenceAvailable === true,
    directAnswerConstrained: answerMode === 'guided-retrieval-first'
  });
}

export function evaluatePedagogicalSafety({
  sourceGrounded = false,
  uncertaintyExplicit = false,
  retrievalPreserved = true,
  generatedClaim = false,
  scholarlyReviewRequired = false,
  humanReviewAvailable = true,
  autonomousAuthorityRequested = false
} = {}) {
  const failures = [];
  if (!sourceGrounded) failures.push('source_grounding_required');
  if (!uncertaintyExplicit) failures.push('uncertainty_must_be_explicit');
  if (!retrievalPreserved) failures.push('retrieval_effort_was_bypassed');
  if (generatedClaim) failures.push('generated_claim_cannot_be_authoritative_evidence');
  if (scholarlyReviewRequired && !humanReviewAvailable) failures.push('human_review_route_required');
  if (autonomousAuthorityRequested) failures.push('autonomous_religious_authority_forbidden');

  return Object.freeze({
    safe: failures.length === 0,
    state: failures.length === 0 ? 'source_grounded' : 'unsafe_for_autonomous_authority',
    failures,
    humanReviewRequired: scholarlyReviewRequired === true,
    acquisitionBlocking: false
  });
}

export function learningIntelligenceV4Policy() {
  return Object.freeze({
    version: V4_VERSION,
    sessionMemory: true,
    durablePersistenceUsesSessionSummaryOnly: true,
    boundedFeedbackBuffer: true,
    feedbackBufferDefaultLimit: DEFAULT_FEEDBACK_BUFFER_LIMIT,
    explicitTransferRoutes: true,
    evidenceGrounded: true,
    verifiedCorpusRemainsAuthoritative: true,
    directAnswersMayBeConstrained: true,
    pedagogicalSafety: true,
    rawSessionEventsDurablyStoredByDefault: false,
    learningMayNotBlockPdfAcquisition: true,
    acquisitionBlocking: false
  });
}
