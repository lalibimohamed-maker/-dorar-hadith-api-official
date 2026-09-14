export const REVIEW_ROLES = Object.freeze(['TEACHER','SCHOLAR']);

export function createReviewQueueEngine() {
  return { queues: new Map(), decisions: new Map() };
}

export function enqueueReview(engine, { reviewId, targetId, role, reason, evidenceState = 'DERIVED', rightsStatus = 'ALLOWED' } = {}) {
  if (!reviewId || !targetId || !reason || !REVIEW_ROLES.includes(role)) throw new TypeError('Review request is incomplete');
  const blocked = rightsStatus === 'UNKNOWN' || rightsStatus === 'RESTRICTED';
  const request = { reviewId, targetId, role, reason, evidenceState, rightsStatus, blocked, status: blocked ? 'BLOCKED_RIGHTS' : 'PENDING' };
  engine.queues.set(reviewId, request);
  return request;
}

export function decideReview(engine, { reviewId, reviewerId, decision, note = '' } = {}) {
  const request = engine.queues.get(reviewId);
  if (!request) throw new Error(`Unknown review: ${reviewId}`);
  if (request.blocked) throw new Error('Rights-blocked material cannot be approved for publication');
  if (!['APPROVE', 'REJECT', 'REQUEST_CHANGES'].includes(decision)) throw new TypeError('Invalid review decision');
  const result = { reviewId, reviewerId, decision, note, decidedAt: new Date().toISOString() };
  request.status = decision;
  engine.decisions.set(reviewId, result);
  return result;
}
