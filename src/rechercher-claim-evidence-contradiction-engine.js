const CLAIM_STATUSES = Object.freeze([
  'DIRECT_SOURCE',
  'DERIVED',
  'SCHOLARLY_INTERPRETATION',
  'AI_SYNTHESIS',
  'HYPOTHESIS',
  'DISPUTED',
]);

const EVIDENCE_STRENGTHS = Object.freeze(['DIRECT', 'STRONG', 'MODERATE', 'WEAK', 'UNKNOWN']);
const REVIEW_STATES = Object.freeze(['UNREVIEWED', 'REVIEW_REQUIRED', 'SCHOLAR_REVIEWED', 'VERIFIED']);

function assertString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${field} is required`);
  }
}

function assertProvenance(provenance) {
  if (!provenance || !Array.isArray(provenance.sourceIds) || provenance.sourceIds.length === 0) {
    throw new Error('claim provenance is required');
  }
}

function createClaim(input = {}) {
  assertString(input.claimId, 'claimId');
  assertString(input.text, 'text');
  assertProvenance(input.provenance);
  const status = input.status || 'HYPOTHESIS';
  if (!CLAIM_STATUSES.includes(status)) throw new Error(`unsupported claim status: ${status}`);
  return {
    claimId: input.claimId,
    text: input.text,
    status,
    provenance: structuredClone(input.provenance),
    reviewState: input.reviewState || (status === 'AI_SYNTHESIS' ? 'REVIEW_REQUIRED' : 'UNREVIEWED'),
    sourceIdentity: input.sourceIdentity || null,
  };
}

function createEvidence(input = {}) {
  assertString(input.evidenceId, 'evidenceId');
  assertString(input.claimId, 'claimId');
  assertProvenance(input.provenance);
  const strength = input.strength || 'UNKNOWN';
  if (!EVIDENCE_STRENGTHS.includes(strength)) throw new Error(`unsupported evidence strength: ${strength}`);
  return {
    evidenceId: input.evidenceId,
    claimId: input.claimId,
    strength,
    provenance: structuredClone(input.provenance),
    passageId: input.passageId || null,
    sourceIdentity: input.sourceIdentity || null,
    reviewState: input.reviewState || 'UNREVIEWED',
  };
}

function createContradiction(input = {}) {
  assertString(input.contradictionId, 'contradictionId');
  assertString(input.leftClaimId, 'leftClaimId');
  assertString(input.rightClaimId, 'rightClaimId');
  assertProvenance(input.provenance);
  return {
    contradictionId: input.contradictionId,
    leftClaimId: input.leftClaimId,
    rightClaimId: input.rightClaimId,
    type: input.type || 'UNRESOLVED',
    confidence: Number.isFinite(input.confidence) ? input.confidence : 0,
    provenance: structuredClone(input.provenance),
    reviewState: input.reviewState || 'REVIEW_REQUIRED',
  };
}

function linkEvidence(claim, evidence) {
  if (claim.claimId !== evidence.claimId) throw new Error('claim/evidence identity mismatch');
  return { claimId: claim.claimId, evidenceId: evidence.evidenceId, relation: 'SUPPORTED_BY' };
}

function linkContradiction(leftClaim, rightClaim, contradiction) {
  const ids = new Set([contradiction.leftClaimId, contradiction.rightClaimId]);
  if (!ids.has(leftClaim.claimId) || !ids.has(rightClaim.claimId)) {
    throw new Error('contradiction endpoint mismatch');
  }
  return { contradictionId: contradiction.contradictionId, endpoints: [leftClaim.claimId, rightClaim.claimId] };
}

function verifyClaim(claim, evidences = [], review = {}) {
  if (claim.status === 'AI_SYNTHESIS' || claim.status === 'HYPOTHESIS') {
    throw new Error('AI-generated or hypothetical claims require scholarly review before verification');
  }
  const supporting = evidences.filter((e) => e.claimId === claim.claimId);
  if (supporting.length === 0) throw new Error('claim requires evidence before verification');
  if (review.reviewState !== 'SCHOLAR_REVIEWED') throw new Error('scholarly review is required before verification');
  return { ...claim, reviewState: 'VERIFIED' };
}

function buildResearchGraph({ claims = [], evidences = [], contradictions = [] } = {}) {
  const claimIds = new Set(claims.map((claim) => claim.claimId));
  const evidenceIds = new Set(evidences.map((evidence) => evidence.evidenceId));
  const nodes = [...claims, ...evidences, ...contradictions];
  const edges = [];
  for (const evidence of evidences) {
    if (!claimIds.has(evidence.claimId)) throw new Error(`missing claim endpoint: ${evidence.claimId}`);
    edges.push({ from: evidence.evidenceId, to: evidence.claimId, relation: 'EVIDENCE_FOR' });
  }
  for (const contradiction of contradictions) {
    if (!claimIds.has(contradiction.leftClaimId) || !claimIds.has(contradiction.rightClaimId)) {
      throw new Error('contradiction references a missing claim');
    }
    edges.push({ from: contradiction.contradictionId, to: contradiction.leftClaimId, relation: 'CONTRADICTS' });
    edges.push({ from: contradiction.contradictionId, to: contradiction.rightClaimId, relation: 'CONTRADICTS' });
  }
  return { nodes, edges, claimIds: [...claimIds], evidenceIds: [...evidenceIds] };
}

export {
  CLAIM_STATUSES,
  EVIDENCE_STRENGTHS,
  REVIEW_STATES,
  createClaim,
  createEvidence,
  createContradiction,
  linkEvidence,
  linkContradiction,
  verifyClaim,
  buildResearchGraph,
};
