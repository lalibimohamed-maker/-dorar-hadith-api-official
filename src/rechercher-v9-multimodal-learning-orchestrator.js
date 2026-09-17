import {
  createV9MultimodalRecitationEngine,
  registerMediaIdentity,
  preprocessModality,
  extractModalityFeatures,
  fuseModalities,
  registerSourceIdentity,
  alignTextToMedia,
  trackRecitation,
  analyzeRecitation,
  recordRecitationAssessment,
  updateMemorizationState,
  scheduleSpacedMemorization,
  createRecitationFeedback,
  alignMultilingualConcept,
} from './rechercher-v9-multimodal-recitation-engine.js';

export const V9_OPERATIONAL_PIPELINE = Object.freeze([
  'MEDIA_IDENTITY', 'PREPROCESSING', 'FEATURE_EXTRACTION', 'PROVENANCE',
  'ALIGNMENT', 'MODALITY_FUSION', 'RECITATION_INTELLIGENCE', 'CANDIDATE_FINDING',
  'GUARDRAILS', 'HUMAN_REVIEW', 'VERIFICATION', 'FEEDBACK', 'ACTIVE_LEARNING',
  'ADAPTIVE_MEMORIZATION'
]);

const RIGHTS = new Set(['ALLOWED', 'RESTRICTED', 'UNKNOWN', 'EXPLICIT_PERMISSION_REQUIRED']);
const clone = value => structuredClone(value);

function requireId(value, name) {
  if (!value) throw new TypeError(`${name} is required`);
}

export function applyV9Guardrails(input = {}) {
  const rights = input.rights || 'UNKNOWN';
  if (!RIGHTS.has(rights)) throw new TypeError(`invalid rights state: ${rights}`);
  const privacy = input.privacy || 'UNKNOWN';
  const terms = input.usageTerms || 'UNKNOWN';
  const publishable = rights === 'ALLOWED' && privacy !== 'BLOCKED' && terms !== 'PROHIBITED';
  return Object.freeze({
    rights,
    privacy,
    usageTerms: terms,
    publishable,
    reviewOnly: !publishable,
    candidateExposure: rights !== 'EXPLICIT_PERMISSION_REQUIRED',
    sourceMutationAllowed: false,
    canonicalQuranMutationAllowed: false,
    originalPdfMutationAllowed: false,
    religiousDecisionAuthority: false,
    reason: publishable ? 'GUARDS_PASSED' : 'REVIEW_OR_PERMISSION_REQUIRED'
  });
}

export function createV9FeedbackEvent(input = {}) {
  requireId(input.feedbackId, 'feedbackId');
  requireId(input.reviewerId, 'reviewerId');
  requireId(input.modelVersion, 'modelVersion');
  if (!Array.isArray(input.evidenceRefs) || input.evidenceRefs.length === 0) throw new TypeError('evidenceRefs are required');
  return Object.freeze({
    feedbackId: input.feedbackId,
    reviewerId: input.reviewerId,
    reviewerRole: input.reviewerRole || 'HUMAN_REVIEWER',
    decision: input.decision || 'CORRECTION',
    correction: clone(input.correction || null),
    evidenceRefs: clone(input.evidenceRefs),
    modelVersion: input.modelVersion,
    createdAt: input.createdAt || new Date().toISOString(),
    appendOnly: true,
    trainingCandidate: input.trainingCandidate !== false,
    automaticDeployment: false,
    authoritativeReligiousJudgment: false
  });
}

export function buildV9ActiveLearningBatch(feedbackEvents = []) {
  if (!Array.isArray(feedbackEvents)) throw new TypeError('feedbackEvents must be an array');
  return Object.freeze({
    batchId: `v9-al-${feedbackEvents.length}-${feedbackEvents.map(event => event.feedbackId).join('-') || 'empty'}`,
    examples: feedbackEvents.map(event => ({ feedbackId: event.feedbackId, evidenceRefs: clone(event.evidenceRefs), correction: clone(event.correction), decision: event.decision })),
    candidateOnly: true,
    deployment: 'FORBIDDEN_WITHOUT_GOVERNED_EVALUATION',
    sourceCorpusMutation: false
  });
}

export function evaluateV9FeedbackImpact(batch, metrics = {}) {
  if (!batch || batch.candidateOnly !== true) throw new TypeError('active-learning batch must be candidate-only');
  return Object.freeze({
    batchId: batch.batchId,
    evaluated: true,
    metrics: clone(metrics),
    deploymentAllowed: false,
    requiresGovernedModelEvaluation: true,
    requiresHumanApproval: true
  });
}

export function runV9MultimodalLearningCase(input = {}) {
  requireId(input.sourceIdentity, 'sourceIdentity');
  if (!Array.isArray(input.media) || input.media.length === 0) throw new TypeError('media is required');
  const engine = createV9MultimodalRecitationEngine({ adapters: input.adapters || {} });
  const source = registerSourceIdentity(engine, input.sourceIdentity);
  const guardrails = applyV9Guardrails(input.guardrails || { rights: source.rights });
  const media = input.media.map(item => registerMediaIdentity(engine, item));

  const processed = media.map(item => preprocessModality(engine, {
    mediaId: item.mediaId,
    targetFormat: input.targetFormats?.[item.modality] || null,
    preprocessingSteps: input.preprocessingSteps?.[item.modality] || [],
    toolchain: input.toolchains?.[item.modality] || []
  }));

  const features = media.map(item => extractModalityFeatures(engine, {
    mediaId: item.mediaId,
    extractor: input.featureExtractors?.[item.modality] || null,
    featureType: input.featureTypes?.[item.modality] || `${item.modality}_FEATURES`,
    confidence: input.featureConfidence?.[item.mediaId] ?? null,
    model: input.models?.[item.modality] || null,
    modelHash: input.modelHashes?.[item.modality] || null
  }));

  const fused = media.length > 1 ? fuseModalities(engine, {
    fusionId: input.fusionId || `fusion:${source.source_id}`,
    mediaIds: media.map(item => item.mediaId),
    method: input.fusionMethod || 'WEIGHTED_EVIDENCE_FUSION',
    confidence: input.fusionConfidence ?? null
  }) : null;

  const alignment = input.alignment ? alignTextToMedia(engine, input.alignment) : null;
  const recitation = input.recitation ? trackRecitation(engine, input.recitation) : null;
  const assessment = input.recitationAnalysis ? analyzeRecitation(input.recitationAnalysis) : null;
  const recordedAssessment = recitation && assessment ? recordRecitationAssessment(engine, recitation.sessionId, assessment) : null;
  const memorization = input.memorization ? updateMemorizationState(engine, input.memorization) : null;
  const spacedReview = memorization && input.spacedReview ? scheduleSpacedMemorization(engine, input.memorization.learnerId, input.memorization.unitId, input.spacedReview) : null;
  const terminology = input.terminology ? alignMultilingualConcept(engine, input.terminology) : null;
  const feedback = input.feedback ? createRecitationFeedback(input.feedback) : null;

  return Object.freeze({
    pipeline: V9_OPERATIONAL_PIPELINE,
    source,
    guardrails,
    media,
    processed,
    features,
    fused,
    alignment,
    recitation,
    assessment,
    recordedAssessment,
    memorization,
    spacedReview,
    terminology,
    feedback,
    authoritativeReligiousJudgment: false,
    canonicalQuranArabicMutated: false,
    originalPdfMutated: false,
    corpusMutated: false
  });
}
