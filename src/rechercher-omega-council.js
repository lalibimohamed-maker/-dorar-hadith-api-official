const REQUIRED_ROLES = Object.freeze([
  "researcher","source_auditor","contrarian","logic_auditor","media_critic","rights_auditor","synthesizer"
]);

export function createCouncilCase({ task, evidence = [], proposed_output = null }) {
  return {
    schema_version: "1.0.0",
    engine: "rechercher-omega-council",
    task,
    evidence_count: evidence.length,
    proposed_output,
    roles: REQUIRED_ROLES.map(role => ({ role, status: "pending", findings: [] })),
    quorum: { required_independent_reviews: 5, achieved: 0 },
    fail_closed: true,
    corpus_write_allowed: false
  };
}

export function submitCouncilReview(caseFile, { role, status, findings = [], evidence_ids = [] }) {
  if (!REQUIRED_ROLES.includes(role)) throw new Error("unknown council role");
  if (!["pass","flag","block"].includes(status)) throw new Error("invalid council review status");
  const next = structuredClone(caseFile);
  const slot = next.roles.find(r => r.role === role);
  if (!slot) throw new Error("council role missing");
  slot.status = status;
  slot.findings = [...findings];
  slot.evidence_ids = [...new Set(evidence_ids)];
  next.quorum.achieved = next.roles.filter(r => ["pass","flag","block"].includes(r.status)).length;
  return next;
}

export function finalizeCouncil(caseFile) {
  const reviewed = caseFile.roles.filter(r => ["pass","flag","block"].includes(r.status));
  if (reviewed.length < caseFile.quorum.required_independent_reviews) {
    return { status: "blocked", reason: "independent-review quorum not reached", corpus_write_allowed: false };
  }
  if (caseFile.roles.some(r => r.status === "block")) {
    return { status: "blocked", reason: "council contains a blocking review", corpus_write_allowed: false };
  }
  if (caseFile.roles.filter(r => r.status === "flag").length > 2) {
    return { status: "blocked", reason: "too many unresolved review flags", corpus_write_allowed: false };
  }
  return { status: "approved_for_next_gate", corpus_write_allowed: false };
}
