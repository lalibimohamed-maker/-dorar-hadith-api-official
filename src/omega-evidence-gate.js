/**
 * Rechercher Ω — Evidence eligibility hard gate.
 *
 * This runtime intentionally separates evidence eligibility from semantic ranking.
 * It accepts only metadata-backed candidates and never uses similarity to override
 * authenticity, provenance, verification, or rights constraints.
 */

const HARD_REJECT_AUTHENTICITY = new Set(["mawdu", "batil", "very_weak"]);

function reject(reason) {
  return { eligible: false, reason };
}

export function isEvidenceEligible(item = {}) {
  if (!item.evidence_id || !item.source || !item.document_id || !item.sha256) {
    return reject("missing_identity_or_hash");
  }
  if (item.rights_status === "unknown" || item.rights_status === "blocked" || !item.rights_status) {
    return reject("rights_not_eligible");
  }
  if (!item.provenance || item.provenance.status !== "verified") {
    return reject("provenance_not_verified");
  }
  if (!["verified", "approved"].includes(item.verification_status)) {
    return reject("verification_not_approved");
  }

  if (item.kind === "hadith") {
    if (!item.authenticity_status || HARD_REJECT_AUTHENTICITY.has(item.authenticity_status)) {
      return reject("hadith_authenticity_not_eligible");
    }
    if (!item.grading_source || !item.grader) {
      return reject("hadith_grade_not_attributed");
    }
  }

  return { eligible: true, evidence: item };
}

export function applyEvidenceHardGate(candidates = []) {
  const accepted = [];
  const rejected = [];

  for (const candidate of candidates) {
    const result = isEvidenceEligible(candidate);
    if (result.eligible) accepted.push(candidate);
    else rejected.push({ evidence_id: candidate.evidence_id ?? null, reason: result.reason });
  }

  return { accepted, rejected };
}

export function runVerifiedRetrievalPipeline({ candidates = [], reranker }) {
  const gate = applyEvidenceHardGate(candidates);
  if (typeof reranker !== "function") throw new TypeError("reranker must be a function");

  // Critical invariant: the reranker receives ONLY hard-gate survivors.
  const reranked = reranker(gate.accepted);

  return {
    rejected: gate.rejected,
    reranked,
    rerankerInputIds: gate.accepted.map((item) => item.evidence_id)
  };
}
