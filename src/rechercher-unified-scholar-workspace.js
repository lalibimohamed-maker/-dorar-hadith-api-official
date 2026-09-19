export const WORKSPACE_ROLES = Object.freeze(['STUDENT','TEACHER','SCHOLAR']);
export const WORKSPACE_STATES = Object.freeze(['ACTIVE','REVIEW_REQUIRED','PUBLISH_BLOCKED']);

export function createUnifiedScholarWorkspace() {
  return { learners: new Map(), sessions: new Map(), links: new Map(), reviews: new Map(), sources: new Map() };
}

function required(value, name) { if (!value) throw new TypeError(`${name} is required`); }

export function registerWorkspaceSource(workspace, { sourceId, sourceHash, rightsStatus = 'UNKNOWN' } = {}) {
  required(sourceId, 'sourceId'); required(sourceHash, 'sourceHash');
  workspace.sources.set(sourceId, { sourceId, sourceHash, rightsStatus });
  return workspace.sources.get(sourceId);
}

export function registerWorkspaceLearner(workspace, { learnerId, role = 'STUDENT', language = 'ar' } = {}) {
  required(learnerId, 'learnerId');
  if (!WORKSPACE_ROLES.includes(role)) throw new TypeError(`Unknown workspace role: ${role}`);
  workspace.learners.set(learnerId, { learnerId, role, language });
  return workspace.learners.get(learnerId);
}

export function openLearningSession(workspace, { sessionId, learnerId, conceptIds = [], sourceIds = [] } = {}) {
  required(sessionId, 'sessionId'); required(learnerId, 'learnerId');
  if (!workspace.learners.has(learnerId)) throw new Error(`Unknown learner: ${learnerId}`);
  const session = { sessionId, learnerId, conceptIds: [...conceptIds], sourceIds: [...sourceIds], state: 'ACTIVE' };
  workspace.sessions.set(sessionId, session);
  return session;
}

export function linkEngineArtifact(workspace, { linkId, sessionId, engine, artifactId, sourceIds = [], reviewRequired = false } = {}) {
  required(linkId, 'linkId'); required(sessionId, 'sessionId'); required(engine, 'engine'); required(artifactId, 'artifactId');
  if (!workspace.sessions.has(sessionId)) throw new Error(`Unknown session: ${sessionId}`);
  for (const sourceId of sourceIds) if (!workspace.sources.has(sourceId)) throw new Error(`Unknown workspace source: ${sourceId}`);
  const link = { linkId, sessionId, engine, artifactId, sourceIds: [...sourceIds], reviewRequired };
  workspace.links.set(linkId, link);
  if (reviewRequired) workspace.sessions.get(sessionId).state = 'REVIEW_REQUIRED';
  return link;
}

export function submitWorkspaceReview(workspace, { reviewId, linkId, reviewerId, reviewerRole, verdict, notes = '' } = {}) {
  required(reviewId, 'reviewId'); required(linkId, 'linkId'); required(reviewerId, 'reviewerId');
  if (!['TEACHER','SCHOLAR'].includes(reviewerRole)) throw new Error('Only teacher or scholar may review workspace artifacts');
  if (!['APPROVED','REJECTED','NEEDS_REVISION'].includes(verdict)) throw new TypeError(`Unknown verdict: ${verdict}`);
  const link = workspace.links.get(linkId); if (!link) throw new Error(`Unknown link: ${linkId}`);
  const review = { reviewId, linkId, reviewerId, reviewerRole, verdict, notes }; workspace.reviews.set(reviewId, review);
  const session = workspace.sessions.get(link.sessionId);
  if (verdict === 'APPROVED') { link.reviewRequired = false; session.state = 'ACTIVE'; }
  else session.state = verdict === 'REJECTED' ? 'PUBLISH_BLOCKED' : 'REVIEW_REQUIRED';
  return review;
}

export function workspacePublishable(workspace, sessionId) {
  const session = workspace.sessions.get(sessionId); if (!session) throw new Error(`Unknown session: ${sessionId}`);
  if (session.state !== 'ACTIVE') return false;
  const links = [...workspace.links.values()].filter((link) => link.sessionId === sessionId);
  if (!links.length) return false;
  return links.every((link) => !link.reviewRequired && link.sourceIds.length > 0 && link.sourceIds.every((id) => workspace.sources.get(id)?.rightsStatus === 'ALLOWED'));
}
