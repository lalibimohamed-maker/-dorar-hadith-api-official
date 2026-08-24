const ROLES = new Set(["reviewer","approver","admin"]);
const TERMINAL = new Set(["approved","rejected"]);

export function createReviewAssignment({ reviewId, sourceId, revisionId, submitterId, assignedReviewerId, assignedApproverId } = {}) {
  if (!reviewId || !sourceId || !revisionId) throw new Error("review provenance is required");
  if (!assignedReviewerId || !assignedApproverId) throw new Error("two-person review assignment is required");
  if (assignedReviewerId === assignedApproverId) throw new Error("reviewer and approver must be different");
  if (submitterId && (submitterId === assignedReviewerId || submitterId === assignedApproverId)) {
    throw new Error("submitter cannot approve their own submission");
  }
  return Object.freeze({ reviewId, sourceId, revisionId, submitterId:submitterId || null, assignedReviewerId, assignedApproverId });
}

export function authorizeDecision({ assignment, actorId, role, decision } = {}) {
  if (!assignment || !actorId || !ROLES.has(role)) return false;
  if (!TERMINAL.has(decision)) return false;
  if (role === "reviewer") return actorId === assignment.assignedReviewerId;
  if (role === "approver") return actorId === assignment.assignedApproverId;
  return false;
}

export function authorizePromotion({ assignment, reviewerId, approverId, reviewerDecision, approverDecision } = {}) {
  return Boolean(
    assignment &&
    reviewerId === assignment.assignedReviewerId &&
    approverId === assignment.assignedApproverId &&
    reviewerId !== approverId &&
    reviewerDecision === "approved" &&
    approverDecision === "approved"
  );
}
