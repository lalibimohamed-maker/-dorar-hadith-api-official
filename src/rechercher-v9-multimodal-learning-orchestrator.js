import { Readable, PassThrough } from 'node:stream';
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

export const V9_RUNTIME_INVARIANTS = Object.freeze({
  AUDIO_STREAMING_REQUIRED: true,
  MAX_AUDIO_PAYLOAD_BYTES: 4 * 1024 * 1024,
  CROSS_MODAL_ANCHOR_REQUIRED_FOR_ERRORS: true,
  SIGNAL_QUALITY_PREFLIGHT_REQUIRED: true,
  MIN_SNR_DB: 12,
  AI_STATUS_LOCK: 'AI_SYNTHESIS_CANDIDATE',
  PUBLIC_GRAPH_REQUIRES_SIGNED_REVIEW: true,
  LEARNER_SANDBOX_ONLY_BEFORE_REVIEW: true,
});

const RIGHTS = new Set(['ALLOWED', 'RESTRICTED', 'UNKNOWN', 'EXPLICIT_PERMISSION_REQUIRED']);
const clone = value => structuredClone(value);
function requireId(value, name) { if (!value) throw new TypeError(`${name} is required`); }

/**
 * Convert any async iterable/Readable audio source into bounded payloads.
 * The orchestrator never buffers the complete recording in memory.
 */
export async function* chunkAudioStream(audioSource, maxPayloadSize = V9_RUNTIME_INVARIANTS.MAX_AUDIO_PAYLOAD_BYTES) {
  if (!Number.isSafeInteger(maxPayloadSize) || maxPayloadSize <= 0) throw new TypeError('maxPayloadSize must be a positive integer');
  const source = audioSource?.[Symbol.asyncIterator] ? audioSource : Readable.from(audioSource || []);
  for await (const value of source) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    for (let offset = 0; offset < chunk.length; offset += maxPayloadSize) {
      yield chunk.subarray(offset, Math.min(offset + maxPayloadSize, chunk.length));
    }
  }
}

/**
 * Live audio tee with bounded PassThrough buffers. A single live source is
 * consumed once; both consumers receive the same bytes and backpressure from
 * either branch pauses the producer.
 */
export function createLiveAudioTee(audioSource, { highWaterMark = V9_RUNTIME_INVARIANTS.MAX_AUDIO_PAYLOAD_BYTES } = {}) {
  if (!audioSource?.[Symbol.asyncIterator]) throw new TypeError('LIVE_AUDIO_ASYNC_SOURCE_REQUIRED');
  const snr = new PassThrough({ highWaterMark });
  const processing = new PassThrough({ highWaterMark });
  let stopped = false;
  const waitDrain = stream => stream.writableNeedDrain ? new Promise((resolve, reject) => {
    const drain = () => { cleanup(); resolve(); };
    const error = err => { cleanup(); reject(err); };
    const cleanup = () => { stream.off('drain', drain); stream.off('error', error); };
    stream.once('drain', drain); stream.once('error', error);
  }) : Promise.resolve();
  const completion = (async () => {
    try {
      for await (const value of audioSource) {
        if (stopped) break;
        const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
        if (!snr.write(chunk)) await waitDrain(snr);
        if (!processing.write(chunk)) await waitDrain(processing);
      }
      snr.end(); processing.end();
    } catch (error) {
      snr.destroy(error); processing.destroy(error);
      throw error;
    }
  })();
  return Object.freeze({
    snrSource: snr,
    processingSource: processing,
    completion,
    stop(reason = new Error('LIVE_AUDIO_TEE_STOPPED')) {
      stopped = true; snr.destroy(reason); processing.destroy(reason);
    }
  });
}

/**
 * Zero-trust streaming bridge: only bounded audio chunks cross the Node/Python boundary.
 * The bridge must consume each chunk independently and MUST NOT receive a whole recording.
 */
async function writeAudioChunkWithBackpressure(writable, chunk) {
  if (typeof writable.write !== 'function') throw new TypeError('audio writable bridge is required');
  if (writable.write(chunk)) return;
  await new Promise((resolve, reject) => {
    const drain = () => { cleanup(); resolve(); };
    const error = err => { cleanup(); reject(err); };
    const cleanup = () => { writable.off('drain', drain); writable.off('error', error); };
    writable.once('drain', drain); writable.once('error', error);
  });
}

export async function streamAudioToPython({ audioSource, bridge, maxPayloadSize = V9_RUNTIME_INVARIANTS.MAX_AUDIO_PAYLOAD_BYTES } = {}) {
  if (!bridge || (typeof bridge.processAudioChunk !== 'function' && typeof bridge.writeAudioChunk !== 'function')) throw new TypeError('zero-trust audio bridge is required');
  const results = [];
  let chunkCount = 0;
  let totalBytes = 0;
  for await (const chunk of chunkAudioStream(audioSource, maxPayloadSize)) {
    if (chunk.byteLength > maxPayloadSize) throw new Error('AUDIO_CHUNK_EXCEEDS_MAX_PAYLOAD');
    const meta = { chunkIndex: chunkCount, maxPayloadSize, mediaOnly: true };
    const result = typeof bridge.processAudioChunk === 'function'
      ? await bridge.processAudioChunk(chunk, meta)
      : await writeAudioChunkWithBackpressure(bridge.writeAudioChunk, chunk);
    results.push(result ?? { accepted: true });
    totalBytes += chunk.byteLength;
    chunkCount += 1;
  }
  return Object.freeze({ chunkCount, totalBytes, results });
}

/**
 * Signal-quality preflight. The only accepted source is a zero-trust media adapter
 * (normally backed by librosa); Node never performs DSP itself and alignment cannot start
 * until the adapter returns an acceptable deterministic SNR decision.
 */
export async function runAudioSignalPreflight({ audioSource, bridge, minSnrDb = V9_RUNTIME_INVARIANTS.MIN_SNR_DB, maxPayloadSize = V9_RUNTIME_INVARIANTS.MAX_AUDIO_PAYLOAD_BYTES } = {}) {
  if (!bridge || typeof bridge.analyzeSignalQuality !== 'function') throw new TypeError('zero-trust signal-quality bridge is required');
  const stream = chunkAudioStream(audioSource, maxPayloadSize);
  const decision = await bridge.analyzeSignalQuality(stream, { analyzer: 'librosa', minSnrDb, maxPayloadSize, mediaOnly: true });
  if (!decision || Number.isNaN(Number(decision.snrDb))) throw new Error('SIGNAL_QUALITY_RESULT_INVALID');
  const accepted = Number(decision.snrDb) >= minSnrDb && decision.accepted !== false;
  if (!accepted) throw new Error(`SIGNAL_QUALITY_REJECTED: SNR=${decision.snrDb}dB < ${minSnrDb}dB`);
  return Object.freeze({ ...clone(decision), analyzer: 'librosa', minSnrDb, accepted: true });
}

function normalizeAnchor(anchor, index) {
  requireId(anchor?.audioTimestamp, `anchorMap[${index}].audioTimestamp`);
  requireId(anchor?.canvasCoordinate, `anchorMap[${index}].canvasCoordinate`);
  requireId(anchor?.canonicalWordId, `anchorMap[${index}].canonicalWordId`);
  return Object.freeze({
    audioTimestamp: clone(anchor.audioTimestamp),
    canvasCoordinate: clone(anchor.canvasCoordinate),
    canonicalWordId: anchor.canonicalWordId,
    mfaTimestamp: clone(anchor.mfaTimestamp || anchor.audioTimestamp),
    iiifCanvasId: anchor.iiifCanvasId || null,
  });
}

export function validateCrossModalityAnchorMap(anchorMap = []) {
  if (!Array.isArray(anchorMap) || anchorMap.length === 0) throw new TypeError('cross-modality anchor map is required');
  return Object.freeze(anchorMap.map(normalizeAnchor));
}

function anchorKey(error) {
  return error?.canonicalWordId || error?.expected?.canonicalWordId || error?.observed?.canonicalWordId || null;
}

export function attachMandatoryErrorAnchors(errors = [], anchorMap) {
  const anchors = validateCrossModalityAnchorMap(anchorMap);
  const byWord = new Map(anchors.map(anchor => [anchor.canonicalWordId, anchor]));
  const seen = new Set();
  return Object.freeze(errors.map((error, index) => {
    const key = anchorKey(error);
    const anchor = byWord.get(key);
    if (!anchor) throw new Error('CROSS_MODAL_ANCHOR_MISSING_FOR_ERROR:' + index);
    if (seen.has(key)) throw new Error('CROSS_MODAL_ANCHOR_DUPLICATE_FOR_ERROR:' + index);
    seen.add(key);
    return Object.freeze({
      ...clone(error),
      canonicalWordId: anchor.canonicalWordId,
      crossModalityAnchor: clone(anchor),
      status: V9_RUNTIME_INVARIANTS.AI_STATUS_LOCK,
      reviewState: 'CANDIDATE',
    });
  }));
}

export function lockV9CandidateStatus(result, { workspace = 'LEARNER_SANDBOX', reviewSignature = null, target = 'LEARNER_SANDBOX' } = {}) {
  if (!result || typeof result !== 'object') throw new TypeError('candidate result is required');
  const status = result.status || V9_RUNTIME_INVARIANTS.AI_STATUS_LOCK;
  if (status !== V9_RUNTIME_INVARIANTS.AI_STATUS_LOCK) throw new Error('V9_AI_STATUS_ESCALATION_BLOCKED');
  if (target === 'PUBLIC_KNOWLEDGE_GRAPH') {
    if (!reviewSignature || reviewSignature.algorithm !== 'ED25519' || !reviewSignature.signature || !reviewSignature.reviewerId) {
      throw new Error('SIGNED_HUMAN_REVIEW_REQUIRED_FOR_PUBLIC_GRAPH');
    }
    if (!['HUMAN_REVIEWED', 'VERIFIED'].includes(reviewSignature.state)) throw new Error('PUBLIC_GRAPH_REVIEW_STATE_INVALID');
  }
  if (target !== 'LEARNER_SANDBOX' && target !== 'PUBLIC_KNOWLEDGE_GRAPH') throw new Error('INVALID_V9_OUTPUT_TARGET');
  return Object.freeze({
    ...clone(result),
    status: V9_RUNTIME_INVARIANTS.AI_STATUS_LOCK,
    workspace,
    target,
    publicGraphEligible: target === 'PUBLIC_KNOWLEDGE_GRAPH' && Boolean(reviewSignature),
    reviewSignature: target === 'PUBLIC_KNOWLEDGE_GRAPH' ? clone(reviewSignature) : null,
    automaticPromotion: false,
  });
}

export function applyV9Guardrails(input = {}) {
  const rights = input.rights || 'UNKNOWN';
  if (!RIGHTS.has(rights)) throw new TypeError(`invalid rights state: ${rights}`);
  const privacy = input.privacy || 'UNKNOWN';
  const terms = input.usageTerms || 'UNKNOWN';
  const publishable = rights === 'ALLOWED' && privacy !== 'BLOCKED' && terms !== 'PROHIBITED';
  return Object.freeze({
    rights, privacy, usageTerms: terms, publishable, reviewOnly: !publishable,
    candidateExposure: rights !== 'EXPLICIT_PERMISSION_REQUIRED', sourceMutationAllowed: false,
    canonicalQuranMutationAllowed: false, originalPdfMutationAllowed: false,
    religiousDecisionAuthority: false, reason: publishable ? 'GUARDS_PASSED' : 'REVIEW_OR_PERMISSION_REQUIRED'
  });
}

export function createV9FeedbackEvent(input = {}) {
  requireId(input.feedbackId, 'feedbackId'); requireId(input.reviewerId, 'reviewerId'); requireId(input.modelVersion, 'modelVersion');
  if (!Array.isArray(input.evidenceRefs) || input.evidenceRefs.length === 0) throw new TypeError('evidenceRefs are required');
  return Object.freeze({ feedbackId: input.feedbackId, reviewerId: input.reviewerId, reviewerRole: input.reviewerRole || 'HUMAN_REVIEWER', decision: input.decision || 'CORRECTION', correction: clone(input.correction || null), evidenceRefs: clone(input.evidenceRefs), modelVersion: input.modelVersion, createdAt: input.createdAt || new Date().toISOString(), appendOnly: true, trainingCandidate: input.trainingCandidate !== false, automaticDeployment: false, authoritativeReligiousJudgment: false });
}

export function buildV9ActiveLearningBatch(feedbackEvents = []) {
  if (!Array.isArray(feedbackEvents)) throw new TypeError('feedbackEvents must be an array');
  return Object.freeze({ batchId: `v9-al-${feedbackEvents.length}-${feedbackEvents.map(event => event.feedbackId).join('-') || 'empty'}`, examples: feedbackEvents.map(event => ({ feedbackId: event.feedbackId, evidenceRefs: clone(event.evidenceRefs), correction: clone(event.correction), decision: event.decision })), candidateOnly: true, deployment: 'FORBIDDEN_WITHOUT_GOVERNED_EVALUATION', sourceCorpusMutation: false });
}

export function evaluateV9FeedbackImpact(batch, metrics = {}) {
  if (!batch || batch.candidateOnly !== true) throw new TypeError('active-learning batch must be candidate-only');
  return Object.freeze({ batchId: batch.batchId, evaluated: true, metrics: clone(metrics), deploymentAllowed: false, requiresGovernedModelEvaluation: true, requiresHumanApproval: true });
}

export async function runV9MultimodalLearningCase(input = {}) {
  requireId(input.sourceIdentity, 'sourceIdentity');
  if (!Array.isArray(input.media) || input.media.length === 0) throw new TypeError('media is required');
  const engine = createV9MultimodalRecitationEngine({ adapters: input.adapters || {} });
  const source = registerSourceIdentity(engine, input.sourceIdentity);
  const guardrails = applyV9Guardrails(input.guardrails || { rights: source.rights });
  const media = input.media.map(item => registerMediaIdentity(engine, item));
  const audioMedia = media.filter(item => item.modality === 'AUDIO');

  let audioPreflight = null;
  let audioStreamReport = null;
  if (audioMedia.length) {
    if (!input.audioSource) throw new Error('AUDIO_STREAM_SOURCE_REQUIRED');
    if (!input.audioBridge) throw new Error('ZERO_TRUST_AUDIO_BRIDGE_REQUIRED');
    const isLiveAudio = input.audioMode === 'LIVE';
    const liveTee = isLiveAudio ? createLiveAudioTee(input.audioSource, { highWaterMark: input.maxAudioPayloadSize || V9_RUNTIME_INVARIANTS.MAX_AUDIO_PAYLOAD_BYTES }) : null;
    const audioSourceFactory = isLiveAudio ? null : resolveAudioSourceFactory({ audioSource: input.audioSource, audioSourceFactory: input.audioSourceFactory });
    const processingPromise = input.streamAudioToPython === false ? null : streamAudioToPython({
      audioSource: isLiveAudio ? liveTee.processingSource : audioSourceFactory(),
      bridge: input.audioBridge,
      maxPayloadSize: input.maxAudioPayloadSize
    });
    try {
      audioPreflight = await runAudioSignalPreflight({
        audioSource: isLiveAudio ? liveTee.snrSource : audioSourceFactory(),
        bridge: input.audioBridge,
        minSnrDb: input.minSnrDb,
        maxPayloadSize: input.maxAudioPayloadSize
      });
      if (processingPromise) audioStreamReport = await processingPromise;
      if (liveTee) await liveTee.completion;
    } catch (error) {
      if (liveTee) liveTee.stop(error);
      if (processingPromise) await processingPromise.catch(() => {});
      throw error;
    }
  }

  const processed = media.map(item => preprocessModality(engine, {
    mediaId: item.mediaId, targetFormat: input.targetFormats?.[item.modality] || null,
    preprocessingSteps: input.preprocessingSteps?.[item.modality] || [], toolchain: input.toolchains?.[item.modality] || []
  }));
  const features = media.map(item => extractModalityFeatures(engine, {
    mediaId: item.mediaId, extractor: input.featureExtractors?.[item.modality] || null,
    featureType: input.featureTypes?.[item.modality] || `${item.modality}_FEATURES`, confidence: input.featureConfidence?.[item.mediaId] ?? null,
    model: input.models?.[item.modality] || null, modelHash: input.modelHashes?.[item.modality] || null
  }));
  const fused = media.length > 1 ? fuseModalities(engine, { fusionId: input.fusionId || `fusion:${source.source_id}`, mediaIds: media.map(item => item.mediaId), method: input.fusionMethod || 'WEIGHTED_EVIDENCE_FUSION', confidence: input.fusionConfidence ?? null }) : null;

  const alignment = input.alignment ? alignTextToMedia(engine, input.alignment) : null;
  const anchorMap = input.anchorMap ? validateCrossModalityAnchorMap(input.anchorMap) : null;
  const recitation = input.recitation ? trackRecitation(engine, input.recitation) : null;
  const assessment = input.recitationAnalysis ? analyzeRecitation(input.recitationAnalysis) : null;
  if (assessment?.errors?.length || assessment?.tajweedCandidates?.length) {
    if (!anchorMap) throw new Error('CROSS_MODAL_ANCHOR_MAP_REQUIRED_BEFORE_RECITATION_ERRORS');
    try {
      assessment.errors = [...attachMandatoryErrorAnchors(assessment.errors, anchorMap)];
      assessment.tajweedCandidates = assessment.tajweedCandidates.map((candidate, index) => {
        const anchored = attachMandatoryErrorAnchors([{ type: 'TAJWEED_CANDIDATE', ...candidate }], anchorMap)[0];
        return { ...anchored, candidateIndex: index };
      });
      assessment.status = V9_RUNTIME_INVARIANTS.AI_STATUS_LOCK;
      assessment.workspace = 'LEARNER_SANDBOX';
      assessment.target = 'LEARNER_SANDBOX';
    } catch (error) {
      throw Object.assign(new Error('V9_CANDIDATE_SESSION_INVALIDATED'), {
        cause: error,
        invalidation: invalidateV9CandidateSession({
          sessionId: recitation?.sessionId || input.sessionId || ('v9-session:' + source.source_id),
          sourceId: source.source_id,
          reason: error.message
        })
      });
    }
  }
  const recordedAssessment = recitation && assessment ? recordRecitationAssessment(engine, recitation.sessionId, assessment) : null;
  const memorization = input.memorization ? updateMemorizationState(engine, input.memorization) : null;
  const spacedReview = memorization && input.spacedReview ? scheduleSpacedMemorization(engine, input.memorization.learnerId, input.memorization.unitId, input.spacedReview) : null;
  const terminology = input.terminology ? alignMultilingualConcept(engine, input.terminology) : null;
  const feedback = input.feedback ? createRecitationFeedback(input.feedback) : null;

  const lockedAssessment = recordedAssessment ? lockV9CandidateStatus(recordedAssessment) : null;
  return Object.freeze({
    pipeline: V9_OPERATIONAL_PIPELINE, runtimeInvariants: V9_RUNTIME_INVARIANTS, source, guardrails, media, audioPreflight, audioStreamReport,
    processed, features, fused, alignment, anchorMap, recitation, assessment: lockedAssessment || assessment, recordedAssessment: lockedAssessment || recordedAssessment,
    memorization, spacedReview, terminology, feedback, authoritativeReligiousJudgment: false, canonicalQuranArabicMutated: false, originalPdfMutated: false, corpusMutated: false,
    publicGraphPromotion: { blockedByDefault: true, requiresSignedHumanReview: true }
  });
}
