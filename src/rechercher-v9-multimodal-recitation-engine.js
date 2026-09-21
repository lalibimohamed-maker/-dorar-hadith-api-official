export const V9_VERSION = '9.0.0';

export const MEDIA_TYPES = Object.freeze(['PDF_PAGE', 'IMAGE', 'AUDIO', 'VIDEO', 'TEXT', 'OCR', 'TRANSCRIPTION']);
export const ALIGNMENT_STATES = Object.freeze(['DISCOVERED', 'ALIGNED', 'CANDIDATE', 'HUMAN_REVIEWED', 'VERIFIED']);
export const RECITATION_STATES = Object.freeze(['RECORDED', 'ALIGNED', 'CANDIDATE_ERROR', 'HUMAN_REVIEWED', 'VERIFIED']);

function clone(value) { return structuredClone(value); }
function requireId(value, name) { if (!value) throw new TypeError(`${name} is required`); }
function clamp(value, min = 0, max = 1) { return Math.min(max, Math.max(min, Number(value) || 0)); }

export function createMediaAsset(input = {}) {
  requireId(input.assetId, 'assetId');
  requireId(input.sourceId, 'sourceId');
  if (!MEDIA_TYPES.includes(input.mediaType)) throw new RangeError(`unsupported mediaType: ${input.mediaType}`);
  return Object.freeze({
    assetId: input.assetId,
    sourceId: input.sourceId,
    mediaType: input.mediaType,
    contentHash: input.contentHash || null,
    locator: input.locator || null,
    rightsStatus: input.rightsStatus || 'UNKNOWN',
    provenance: input.provenance || null,
    immutable: true,
  });
}

export function createAlignment({ alignmentId, assetId, sourceId, targetId, startMs, endMs, textRange = null, confidence = 0, state = 'DISCOVERED' } = {}) {
  requireId(alignmentId, 'alignmentId');
  requireId(assetId, 'assetId');
  requireId(sourceId, 'sourceId');
  requireId(targetId, 'targetId');
  if (!ALIGNMENT_STATES.includes(state)) throw new RangeError(`unsupported alignment state: ${state}`);
  if (Number(startMs) < 0 || Number(endMs) < Number(startMs)) throw new RangeError('invalid alignment timing');
  return clone({ alignmentId, assetId, sourceId, targetId, startMs: Number(startMs), endMs: Number(endMs), textRange, confidence: clamp(confidence), state });
}

export function createRecitationRecord({ recitationId, learnerId, sourceId, ayahId, audioAssetId, alignments = [], state = 'RECORDED' } = {}) {
  requireId(recitationId, 'recitationId');
  requireId(learnerId, 'learnerId');
  requireId(sourceId, 'sourceId');
  requireId(ayahId, 'ayahId');
  requireId(audioAssetId, 'audioAssetId');
  if (!RECITATION_STATES.includes(state)) throw new RangeError(`unsupported recitation state: ${state}`);
  return clone({ recitationId, learnerId, sourceId, ayahId, audioAssetId, alignments, state, canonicalTextImmutable: true });
}

export function proposeRecitationFinding({ findingId, recitationId, sourceId, type, locator, confidence = 0, evidence = [] } = {}) {
  requireId(findingId, 'findingId');
  requireId(recitationId, 'recitationId');
  requireId(sourceId, 'sourceId');
  return clone({ findingId, recitationId, sourceId, type: type || 'CANDIDATE_ERROR', locator: locator || null, confidence: clamp(confidence), evidence: [...evidence], state: 'CANDIDATE_ERROR', humanVerified: false });
}

export function reviewRecitationFinding(finding, { reviewerId, decision, note = '' } = {}) {
  requireId(finding?.findingId, 'finding.findingId');
  requireId(reviewerId, 'reviewerId');
  if (!['VERIFIED', 'REJECTED', 'REVIEWED'].includes(decision)) throw new RangeError(`unsupported review decision: ${decision}`);
  return clone({ ...finding, state: decision === 'VERIFIED' ? 'HUMAN_REVIEWED' : 'HUMAN_REVIEWED', humanVerified: decision !== 'REJECTED', reviewerId, reviewNote: note });
}

export function verifyRecitationRecord(record, { reviewedFindingIds = [] } = {}) {
  requireId(record?.recitationId, 'record.recitationId');
  const findings = record.findings || [];
  const allReviewed = findings.every(finding => reviewedFindingIds.includes(finding.findingId));
  return clone({ ...record, state: allReviewed ? 'VERIFIED' : 'CANDIDATE_ERROR', verification: { allReviewed, reviewedFindingIds: [...reviewedFindingIds] } });
}

export function createV9MultimodalRecitationEngine({ assets = [], alignments = [], recitations = [] } = {}) {
  return {
    version: V9_VERSION,
    assets: assets.map(createMediaAsset),
    alignments: alignments.map(createAlignment),
    recitations: recitations.map(clone),
    policy: {
      sourceFirst: true,
      canonicalQuranArabicImmutable: true,
      originalPdfImmutable: true,
      candidateErrorsRequireHumanReview: true,
      rightsBypass: false,
      acquisitionIndependent: true,
      automatedFindingIsNotFinalReligiousJudgment: true,
    },
  };
}
