export const CONFIDENCE_STATES = Object.freeze(['UNVERIFIED', 'SUPPORTED', 'DISPUTED', 'VERIFIED']);
export const CONFLICT_TYPES = Object.freeze(['ACCEPTED_VARIATION', 'APPARENT_CONTRADICTION', 'TRUE_CONTRADICTION']);

const clamp = value => Math.max(0, Math.min(1, value));

export const DEFAULT_EVIDENCE_WEIGHTS = Object.freeze({
  sourceAuthenticity: 0.35,
  transmissionChains: 0.30,
  scholarlyConsensus: 0.35
});

export function scoreGroundedConfidence(input = {}, weights = DEFAULT_EVIDENCE_WEIGHTS) {
  const sourceAuthenticity = clamp(input.sourceAuthenticity ?? 0);
  const transmissionChains = clamp(input.transmissionChains ?? 0);
  const scholarlyConsensus = clamp(input.scholarlyConsensus ?? 0);
  const base = clamp(sourceAuthenticity * transmissionChains * scholarlyConsensus);
  const acceptedVariation = input.conflictType === 'ACCEPTED_VARIATION';
  const apparent = input.conflictType === 'APPARENT_CONTRADICTION';
  const trueContradiction = input.conflictType === 'TRUE_CONTRADICTION';
  const multiplier = acceptedVariation ? 1 : apparent ? 0.95 : trueContradiction ? 0.35 : 1;
  const confidence = clamp(base * multiplier);
  return {
    confidence,
    state: trueContradiction ? 'DISPUTED' : (input.verified ? 'VERIFIED' : confidence > 0 ? 'SUPPORTED' : 'UNVERIFIED'),
    components: { sourceAuthenticity, transmissionChains, scholarlyConsensus },
    conflictType: input.conflictType || null,
    weights: { ...weights },
    rationale: trueContradiction ? 'TRUE_CONTRADICTION forces DISPUTED and materially reduces confidence.' : acceptedVariation ? 'Accepted scholarly variation does not reduce confidence.' : 'Confidence remains evidence-grounded and bounded to [0,1].'
  };
}

export function createClaimEvidenceRecord(input = {}) {
  if (!input.claimId || !input.provenance) throw new TypeError('claimId and provenance are required');
  const score = scoreGroundedConfidence(input);
  return Object.freeze({ claimId: input.claimId, confidence: score.confidence, state: score.state, provenance: structuredClone(input.provenance), evidenceIds: [...(input.evidenceIds || [])], conflictType: score.conflictType, createdAt: input.createdAt || new Date().toISOString(), immutableEvidence: true });
}
