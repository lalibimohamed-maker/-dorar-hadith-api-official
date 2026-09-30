const REJECTED_HADITH_STATUSES = new Set(["mawdu", "batil", "very_weak"]);
const APPROVED_VERIFICATION = new Set(["verified", "approved", "source_verified", "edition_verified", "scholar_reviewed"]);
const HEX_SHA256=/^[a-f0-9]{64}$/;

function normalize(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : value;
}

function evidenceId(candidate) {
  return candidate?.evidence_id ?? candidate?.node_id ?? candidate?.hadith_id ?? null;
}

function source(candidate) {
  return candidate?.source ?? candidate?.provenance?.source ?? candidate?.canonical_source ?? null;
}

function documentId(candidate) {
  return candidate?.document_id ?? candidate?.provenance?.document_id ?? null;
}

function provenanceReady(candidate) {
  const value=candidate?.provenance;
  if (typeof value === "string") return !["", "unverified", "unknown"].includes(normalize(value));
  return Boolean(
    value &&
    typeof value === "object" &&
    String(value.source ?? "").trim() &&
    String(value.document_id ?? "").trim()
  );
}

export function evaluateEvidenceEligibility(candidate, options = {}) {
  const reasons = [];
  const type = normalize(candidate?.type ?? candidate?.evidenceType ?? candidate?.category ?? "unknown");
  const rights = normalize(candidate?.rights_status);
  const verification = normalize(candidate?.verification_status);
  const provenance = provenanceReady(candidate);
  const sha256 = String(candidate?.sha256 ?? "").trim().toLowerCase();

  if (!evidenceId(candidate)) reasons.push("missing_evidence_id");
  if (!source(candidate)) reasons.push("missing_source");
  if (!documentId(candidate)) reasons.push("missing_document_id");
  if (!sha256) reasons.push("missing_sha256");
  else if (!HEX_SHA256.test(sha256)) reasons.push("invalid_sha256");
  if (!rights || rights === "unknown" || rights === "blocked") reasons.push("rights_unknown_or_blocked");
  if (!provenance) reasons.push("provenance_missing_or_unverified");
  if (!APPROVED_VERIFICATION.has(verification)) reasons.push("verification_not_approved");

  if (type === "hadith") {
    const authenticity = normalize(candidate?.authenticity_status ?? candidate?.grade);
    if (!authenticity) reasons.push("hadith_authenticity_unknown");
    else if (REJECTED_HADITH_STATUSES.has(authenticity)) reasons.push("hadith_authenticity_rejected");
    else if (authenticity === "weak" && options.allowLabeledWeakResearch !== true) reasons.push("weak_hadith_not_eligible_as_sound_evidence");
    else if (authenticity === "weak" && candidate?.weakResearchLabel !== true) reasons.push("weak_hadith_requires_explicit_research_label");
  }

  return Object.freeze({
    eligible: reasons.length === 0,
    reasons: Object.freeze(reasons),
    candidateId: evidenceId(candidate)
  });
}

export function applyEvidenceHardGate(candidates, options = {}) {
  if (!Array.isArray(candidates)) throw new TypeError("candidates must be an array");
  const accepted = [], rejected = [];
  for (const candidate of candidates) {
    const decision = evaluateEvidenceEligibility(candidate, options);
    (decision.eligible ? accepted : rejected).push(decision.eligible ? candidate : { candidate, decision });
  }
  return Object.freeze({ accepted: Object.freeze(accepted), rejected: Object.freeze(rejected) });
}

export function rerankVerifiedEvidence(verifiedEvidence, reranker) {
  if (!Array.isArray(verifiedEvidence)) throw new TypeError("verifiedEvidence must be an array");
  if (typeof reranker !== "function") throw new TypeError("reranker must be a function");
  return reranker(verifiedEvidence);
}

export function buildGroundedGenerationContext(rerankedEvidence, claims) {
  if (!Array.isArray(rerankedEvidence) || rerankedEvidence.length === 0 || !Array.isArray(claims) || claims.length === 0) {
    return { ok: false, code: "NO_EVIDENCE", evidence: [], claims: [] };
  }
  const evidenceIds = new Set(rerankedEvidence.map((item) => evidenceId(item)).filter(Boolean));
  const missing = claims
    .map((claim, index) => ({ claim, index }))
    .filter(({ claim }) => !claim?.evidence_id || !evidenceIds.has(claim.evidence_id));

  if (missing.length) {
    return {
      ok: false,
      code: "NO_EVIDENCE",
      reason: "CLAIM_WITHOUT_VALID_EVIDENCE_ID",
      missingClaimIndexes: missing.map(({ index }) => index)
    };
  }
  return { ok: true, code: "EVIDENCE_READY", evidence: rerankedEvidence, claims };
}

export function runOmegaEvidenceContract({ candidates, reranker, claims, options = {} }) {
  const gated = applyEvidenceHardGate(candidates, options);
  if (gated.accepted.length === 0) return { ok: false, code: "NO_EVIDENCE", rejected: gated.rejected, reranked: [] };
  const reranked = rerankVerifiedEvidence(gated.accepted, reranker);
  const context = buildGroundedGenerationContext(reranked, claims);
  return { ...context, rejected: gated.rejected, reranked };
}
