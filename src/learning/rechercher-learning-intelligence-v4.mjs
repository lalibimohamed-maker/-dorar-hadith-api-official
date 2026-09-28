/**
 * Rechercher Learning Intelligence Engine v4.
 *
 * V4 adds memory tiers, bounded session feedback, explicit cross-domain
 * transfer routing, and pedagogical safety. It remains downstream of
 * acquisition and cannot become a corpus/acquisition gate.
 */

export const V4_VERSION = '4.0.0';

export const MEMORY_TIERS = Object.freeze(['session', 'long_term']);

export const FEEDBACK_SIGNALS = Object.freeze([
  'pause',
  'hesitation',
  'revision',
  'hint_request',
  'answer_attempt',
  'confidence_change',
  'navigation',
  'completion'
]);

export const SAFETY_POLICIES = Object.freeze({
  preserveStruggle: true,
  scaffoldBeforeAnswer: true,
  noAnswerDump: true,
  progressiveDisclosure: true,
  learnerAgency: true,
  sourceGrounded: true,
  rightsAware: true,
  noBiometricInferenceByDefault: true
});

const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, Number(n) || 0));
const asArray = value => Array.isArray(value) ? value : [];
const unique = value => [...new Set(asArray(value).filter(Boolean))];
const nowIso = () => new Date().toISOString();

function clone(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

export function createSessionMemory(input = {}) {
  return {
    sessionId: input.sessionId ?? null,
    startedAt: input.startedAt ?? nowIso(),
    currentSkillId: input.currentSkillId ?? null,
    recentItems: [...asArray(input.recentItems)].slice(-20),
    recentSignals: [...asArray(input.recentSignals)].slice(-50),
    workingHypotheses: { ...(input.workingHypotheses ?? {}) },
    transientDiagnosis: input.transientDiagnosis ?? null
  };
}

export function createLongTermMemory(input = {}) {
  return {
    learnerId: input.learnerId ?? null,
    skills: clone(input.skills ?? {}),
    modalityProfile: clone(input.modalityProfile ?? {}),
    calibration: clone(input.calibration ?? {}),
    misconceptions: clone(input.misconceptions ?? {}),
    transferHistory: [...asArray(input.transferHistory)].slice(-100),
    updatedAt: input.updatedAt ?? null
  };
}

/**
 * Session micro-signals are explicitly volatile. They may inform current
 * diagnosis but are not a long-term journal unless summarized.
 */
export function createMemoryState(input = {}) {
  return {
    version: V4_VERSION,
    session: createSessionMemory(input.session),
    longTerm: createLongTermMemory(input.longTerm)
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
    at: signal.at ?? nowIso()
  };
  next.session.recentSignals = [...next.session.recentSignals, event].slice(-50);
  if (signal.itemId) next.session.recentItems = [signal.itemId, ...next.session.recentItems.filter(id => id !== signal.itemId)].slice(0, 20);
  return next;
}

export function feedbackBufferStatus(memory) {
  return {
    size: memory?.session?.recentSignals?.length ?? 0,
    maxSize: 50,
    bounded: true,
    rawDiaryPersisted: false
  };
}

export function summarizeSession(memory, {
  skillId,
  mastery,
  confidence,
  modality,
  calibration,
  misconceptions = [],
  transferRecord = null
} = {}) {
  const next = createMemoryState(memory);

  if (skillId) {
    next.longTerm.skills[skillId] = {
      ...(next.longTerm.skills[skillId] ?? {}),
      ...(Number.isFinite(mastery) ? { mastery: clamp(mastery) } : {}),
      lastSessionId: next.session.sessionId
    };
  }

  if (modality) {
    next.longTerm.modalityProfile[modality] = {
      ...(next.longTerm.modalityProfile[modality] ?? {}),
      ...(Number.isFinite(memory?.session?.recentSignals?.length)
        ? { recentSignalCount: memory.session.recentSignals.length }
        : {})
    };
  }

  if (Number.isFinite(confidence)) next.longTerm.calibration.lastConfidence = clamp(confidence);
  if (calibration) next.longTerm.calibration = { ...next.longTerm.calibration, ...clone(calibration) };

  for (const misconception of asArray(misconceptions)) {
    if (misconception?.id) {
      next.longTerm.misconceptions[misconception.id] = {
        ...(next.longTerm.misconceptions[misconception.id] ?? {}),
        status: misconception.status ?? 'hypothesis',
        evidenceCount: Math.max(0, Number(misconception.evidenceCount) || 1),
        updatedAt: nowIso()
      };
    }
  }

  if (transferRecord) next.longTerm.transferHistory = [...next.longTerm.transferHistory, transferRecord].slice(-100);

  next.longTerm.updatedAt = nowIso();
  next.session.recentSignals = [];
  next.session.transientDiagnosis = null;
  return next;
}

export function discardSessionMemory(memory) {
  return {
    version: V4_VERSION,
    session: null,
    longTerm: createLongTermMemory(memory?.longTerm)
  };
}

export function createCrossDomainGraph(input = {}) {
  return {
    version: V4_VERSION,
    domains: clone(input.domains ?? {}),
    skills: clone(input.skills ?? {}),
    edges: [...asArray(input.edges)].map(edge => ({ ...edge }))
  };
}

function validTransferEdge(edge = {}) {
  return Boolean(
    edge.from &&
    edge.to &&
    edge.from !== edge.to &&
    edge.sourceSkillId &&
    edge.targetSkillId &&
    edge.sourceSkillId === edge.from &&
    edge.targetSkillId === edge.to &&
    edge.relation &&
    Array.isArray(edge.evidence) &&
    edge.evidence.length > 0 &&
    edge.provenance &&
    edge.provenance.sourceId &&
    (edge.provenance.anchor || edge.provenance.page || edge.provenance.location)
  );
}

export function validateCrossDomainEdge(edge = {}) {
  const errors = [];
  if (!validTransferEdge(edge)) {
    if (!edge?.from || !edge?.to || edge?.from === edge?.to) errors.push('valid cross-domain endpoints required');
    if (!edge?.sourceSkillId || !edge?.targetSkillId) errors.push('sourceSkillId and targetSkillId required');
    if (!edge?.relation) errors.push('transfer relation required');
    if (!Array.isArray(edge?.evidence) || edge.evidence.length === 0) errors.push('transfer evidence required');
    if (!edge?.provenance?.sourceId || !(edge.provenance.anchor || edge.provenance.page || edge.provenance.location)) {
      errors.push('transfer provenance required');
    }
  }
  return { ok: errors.length === 0, errors };
}

export function addCrossDomainEdge(graph, edge) {
  const validation = validateCrossDomainEdge(edge);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  if (!graph.skills?.[edge.from] || !graph.skills?.[edge.to]) throw new Error('cross-domain endpoints must exist');

  const next = createCrossDomainGraph(graph);
  next.edges.push({
    ...edge,
    sourceSkillId: edge.from,
    targetSkillId: edge.to,
    confidence: clamp(edge.confidence ?? 0.5)
  });
  return next;
}

export function findTransferRoutes(graph, fromSkillId, targetDomain) {
  return (graph.edges ?? [])
    .filter(edge => edge.from === fromSkillId && graph.skills?.[edge.to]?.domain === targetDomain)
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    .map(edge => ({
      ...edge,
      targetSkillId: edge.to,
      sourceDomain: graph.skills?.[edge.from]?.domain ?? null,
      targetDomain: graph.skills?.[edge.to]?.domain ?? null
    }));
}

export function evaluateTransfer({
  sourceSkill,
  targetSkill,
  sourceMastery = 0,
  targetMasteryBefore = 0,
  result,
  confidence = 0.5,
  delayed = false
} = {}) {
  const correct = Boolean(result?.correct);
  const transferScore = correct ? clamp(result?.score ?? 1) : 0;
  const sourceMastery = clamp(sourceMastery);
  const targetBefore = clamp(targetMasteryBefore);
  return {
    sourceSkill,
    targetSkill,
    sourceDomainMastery: sourceMastery,
    targetDomainMasteryBefore: targetBefore,
    transferScore,
    confidence: clamp(confidence),
    delayed: Boolean(delayed),
    evidenceLevel: result?.sourceGrounded ? 'source-grounded' : 'observed',
    status: transferScore >= 0.7 ? 'demonstrated' : 'needs-practice',
    sourceMasteryDistinctFromTransfer: true
  };
}

export function compareSourceAndTransferMastery({
  sourceMastery = 0,
  transferScore = 0
} = {}) {
  return {
    sourceMastery: clamp(sourceMastery),
    transferScore: clamp(transferScore),
    transferGap: roundSigned(clamp(sourceMastery) - clamp(transferScore))
  };
}

function roundSigned(n) {
  return Number(Number(n).toFixed(6));
}

export function applyPedagogicalSafety({
  response,
  learnerState = {},
  context = {},
  source = null
} = {}) {
  const text = String(response ?? '');
  const directAnswer = Boolean(context.directAnswer);
  const hintRequested = Boolean(context.hintRequested);
  const struggling = Boolean(learnerState.struggling || learnerState.repeatedErrors);
  const shouldScaffold = SAFETY_POLICIES.scaffoldBeforeAnswer && (hintRequested || struggling) && directAnswer;
  const sourceGrounded = context.sourceGrounded !== false;
  const rightsAware = context.rightsAware !== false;

  return {
    allowed: Boolean(text) &&
      (!shouldScaffold || context.scaffolded === true) &&
      sourceGrounded &&
      rightsAware,
    action: shouldScaffold ? 'scaffold-first' : 'deliver',
    avoidDirectAnswer: shouldScaffold,
    preserveAgency: true,
    sourceGrounded,
    rightsAware,
    supportingSource: source,
    progressiveDisclosure: SAFETY_POLICIES.progressiveDisclosure,
    noBiometricInference: true,
    reason: shouldScaffold
      ? 'support retrieval before revealing the answer'
      : (!sourceGrounded ? 'source grounding required' : (!rightsAware ? 'rights awareness required' : 'deliver within safety policy'))
  };
}

export function canPersistRawFeedbackDiary() {
  return false;
}

export function canLearningBlockAcquisition() {
  return false;
}

export function getV4Capabilities() {
  return {
    engine: 'Rechercher Learning Intelligence Engine v4',
    version: V4_VERSION,
    memoryTiers: [...MEMORY_TIERS],
    feedbackSignals: [...FEEDBACK_SIGNALS],
    feedbackBuffer: { maxSessionEvents: 50, rawDiaryPersisted: false },
    crossDomainTransfer: {
      explicitSourceAndTargetSkills: true,
      evidenceRequired: true,
      provenanceRequired: true,
      separateTransferEvaluation: true
    },
    pedagogicalSafety: { ...SAFETY_POLICIES },
    acquisitionIndependent: true
  };
}
