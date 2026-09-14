export const V4_VERSION = '4.0.0';

export const MEMORY_TIERS = ['session', 'long_term'];
export const FEEDBACK_SIGNALS = [
  'pause',
  'hesitation',
  'revision',
  'hint_request',
  'answer_attempt',
  'confidence_change',
  'navigation',
  'completion',
];

const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, Number(n) || 0));

/**
 * Session memory is ephemeral and may be discarded at session end.
 * Long-term memory is an explicit learner-state summary, not a raw event log.
 */
export function createMemoryState(input = {}) {
  return {
    version: V4_VERSION,
    session: {
      sessionId: input.session?.sessionId ?? null,
      startedAt: input.session?.startedAt ?? null,
      currentSkillId: input.session?.currentSkillId ?? null,
      recentItems: Array.isArray(input.session?.recentItems) ? [...input.session.recentItems] : [],
      recentSignals: Array.isArray(input.session?.recentSignals) ? [...input.session.recentSignals] : [],
      workingHypotheses: { ...(input.session?.workingHypotheses || {}) },
    },
    longTerm: {
      learnerId: input.longTerm?.learnerId ?? null,
      skills: { ...(input.longTerm?.skills || {}) },
      modalityProfile: { ...(input.longTerm?.modalityProfile || {}) },
      calibration: { ...(input.longTerm?.calibration || {}) },
      misconceptions: { ...(input.longTerm?.misconceptions || {}) },
      transferHistory: Array.isArray(input.longTerm?.transferHistory) ? [...input.longTerm.transferHistory] : [],
      updatedAt: input.longTerm?.updatedAt ?? null,
    },
  };
}

export function recordFeedbackSignal(memory, signal = {}) {
  if (!FEEDBACK_SIGNALS.includes(signal.type)) throw new Error('invalid feedback signal');
  const next = createMemoryState(memory);
  const event = {
    type: signal.type,
    itemId: signal.itemId ?? null,
    skillId: signal.skillId ?? null,
    value: signal.value ?? null,
    at: signal.at ?? null,
  };
  next.session.recentSignals.push(event);
  if (next.session.recentSignals.length > 50) next.session.recentSignals = next.session.recentSignals.slice(-50);
  return next;
}

/** Convert granular session evidence into a compact, reviewable learner-state update. */
export function summarizeSession(memory, { skillId, mastery, confidence, modality, calibration } = {}) {
  const next = createMemoryState(memory);
  if (skillId) {
    next.longTerm.skills[skillId] = {
      ...(next.longTerm.skills[skillId] || {}),
      mastery: clamp(mastery ?? next.longTerm.skills[skillId]?.mastery ?? 0),
      lastSessionId: next.session.sessionId,
    };
  }
  if (modality) {
    next.longTerm.modalityProfile[modality] = {
      ...(next.longTerm.modalityProfile[modality] || {}),
      proficiency: clamp(proficiencyValue(modality, next, memory)),
    };
  }
  if (Number.isFinite(confidence)) next.longTerm.calibration.lastConfidence = clamp(confidence);
  if (calibration) next.longTerm.calibration = { ...next.longTerm.calibration, ...calibration };
  next.longTerm.updatedAt = new Date().toISOString();
  next.session.recentSignals = [];
  return next;
}

function proficiencyValue(modality, next, previous) {
  const current = next.longTerm.modalityProfile[modality]?.proficiency;
  if (Number.isFinite(current)) return current;
  return clamp(previous?.longTerm?.modalityProfile?.[modality]?.proficiency ?? 0);
}

export function createCrossDomainGraph(input = {}) {
  return {
    version: V4_VERSION,
    domains: { ...(input.domains || {}) },
    skills: { ...(input.skills || {}) },
    edges: Array.isArray(input.edges) ? [...input.edges] : [],
  };
}

export function addCrossDomainEdge(graph, edge) {
  if (!edge?.from || !edge?.to || edge.from === edge.to || !edge.relation) throw new Error('invalid cross-domain edge');
  if (!graph.skills?.[edge.from] || !graph.skills?.[edge.to]) throw new Error('cross-domain endpoints must exist');
  const next = createCrossDomainGraph(graph);
  next.edges.push({
    from: edge.from,
    to: edge.to,
    relation: edge.relation,
    evidence: edge.evidence ?? [],
    confidence: clamp(edge.confidence ?? 0.5),
  });
  return next;
}

export function findTransferRoutes(graph, fromSkillId, targetDomain) {
  const routes = [];
  for (const edge of graph.edges || []) {
    if (edge.from !== fromSkillId) continue;
    const target = graph.skills[edge.to];
    if (target?.domain === targetDomain) routes.push({ ...edge, targetSkillId: edge.to });
  }
  return routes.sort((a, b) => b.confidence - a.confidence);
}

export function evaluateTransfer({ sourceSkill, targetSkill, result, confidence = 0.5 } = {}) {
  const correct = Boolean(result?.correct);
  const transferScore = correct ? clamp(result?.score ?? 1) : 0;
  return {
    sourceSkill,
    targetSkill,
    transferScore,
    confidence: clamp(confidence),
    evidenceLevel: result?.sourceGrounded ? 'source-grounded' : 'observed',
    status: transferScore >= 0.7 ? 'demonstrated' : 'needs-practice',
  };
}

export const SAFETY_POLICIES = {
  preserveStruggle: true,
  scaffoldBeforeAnswer: true,
  noAnswerDump: true,
  progressiveDisclosure: true,
  learnerAgency: true,
  sourceGrounded: true,
  rightsAware: true,
  noBiometricInferenceByDefault: true,
};

export function applyPedagogicalSafety({ response, learnerState = {}, context = {} } = {}) {
  const text = String(response ?? '');
  const directAnswer = Boolean(context.directAnswer);
  const hintRequested = Boolean(context.hintRequested);
  const struggling = Boolean(learnerState.struggling || learnerState.repeatedErrors);
  const shouldScaffold = SAFETY_POLICIES.scaffoldBeforeAnswer && (hintRequested || struggling) && directAnswer;
  return {
    allowed: Boolean(text) && (!shouldScaffold || context.scaffolded === true),
    action: shouldScaffold ? 'scaffold-first' : 'deliver',
    avoidDirectAnswer: shouldScaffold,
    preserveAgency: true,
    reason: shouldScaffold ? 'support retrieval before revealing the answer' : 'no pedagogical safety conflict detected',
  };
}

export function canLearningBlockAcquisition() { return false; }
