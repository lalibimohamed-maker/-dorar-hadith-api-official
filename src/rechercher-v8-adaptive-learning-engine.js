export const V8_VERSION = '8.0.0';

export const LEARNING_STAGES = Object.freeze([
  'DIAGNOSE',
  'LEARN',
  'EXAMPLE',
  'RETRIEVE',
  'APPLY',
  'CORRECT',
  'RETRIEVE_AGAIN',
  'TRANSFER',
  'TEST',
  'MASTER'
]);

export const ADAPTATION_ACTIONS = Object.freeze([
  'REVIEW_PREREQUISITE',
  'RETEACH',
  'SHOW_EXAMPLE',
  'LOWER_DIFFICULTY',
  'RAISE_DIFFICULTY',
  'RETRIEVAL_PRACTICE',
  'TRANSFER_PRACTICE',
  'SPACED_REVIEW',
  'SCHEDULE_RETEST',
  'ADVANCE'
]);

export const CONTENT_STATUSES = Object.freeze([
  'SOURCE_VERIFIED',
  'SCHOLAR_REVIEWED',
  'DERIVED',
  'AI_SYNTHESIS',
  'HYPOTHESIS'
]);

const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, Number(n) || 0));

function clone(value) {
  return structuredClone(value);
}

export function createLearnerState(input = {}) {
  return {
    version: 1,
    learnerId: input.learnerId || null,
    skills: { ...(input.skills || {}) },
    misconceptions: { ...(input.misconceptions || {}) },
    goals: [...(input.goals || [])],
    history: [...(input.history || [])],
  };
}

export function observeSkill(state, skillId, observation = {}) {
  if (!skillId) throw new TypeError('skillId is required');
  const next = createLearnerState(state);
  const previous = next.skills[skillId] || { mastery: 0, confidence: 0.5, attempts: 0, successes: 0, failures: 0 };
  const correct = Boolean(observation.correct);
  const mastery = clamp((previous.mastery * Math.min(previous.attempts, 9) + (correct ? 1 : 0)) / (Math.min(previous.attempts, 9) + 1));
  next.skills[skillId] = {
    ...previous,
    mastery: Number(mastery.toFixed(6)),
    confidence: clamp(observation.confidence ?? previous.confidence),
    attempts: previous.attempts + 1,
    successes: previous.successes + (correct ? 1 : 0),
    failures: previous.failures + (correct ? 0 : 1),
    lastObservedAt: observation.at,
  };
  next.history.push({ skillId, correct, confidence: next.skills[skillId].confidence, at: observation.at || null });
  return next;
}

export function diagnoseLearner({ graph, state, skillId, result = {} } = {}) {
  const skill = state?.skills?.[skillId] || { mastery: 0, confidence: 0.5, attempts: 0 };
  const prerequisites = (graph?.edges || [])
    .filter(edge => edge.to === skillId && ['requires', 'strongly_requires', 'recommended_before', 'depends_on'].includes(edge.relation))
    .map(edge => ({ skillId: edge.from, mastery: state?.skills?.[edge.from]?.mastery ?? 0, relation: edge.relation }))
    .filter(item => item.mastery < 0.7);
  const misconception = !result.correct
    ? (graph?.edges || []).filter(edge => edge.from === skillId && ['caused_by', 'confused_with'].includes(edge.relation))
      .map(edge => ({ skillId: edge.to, confidence: edge.confidence ?? 0.5 }))
      .sort((a, b) => b.confidence - a.confidence)[0] || null
    : null;
  const confidenceError = Math.abs(clamp(result.confidence ?? skill.confidence) - (result.correct ? 1 : 0));
  return clone({
    skillId,
    mastery: skill.mastery,
    confidence: skill.confidence,
    attempts: skill.attempts,
    prerequisiteGaps: prerequisites,
    misconception,
    confidenceError: Number(confidenceError.toFixed(6)),
    needsIntervention: skill.mastery < 0.7 || prerequisites.length > 0 || Boolean(misconception),
  });
}

export function chooseDifficulty({ mastery = 0, confidence = 0.5, target = 0.75 } = {}) {
  const gap = target - clamp(mastery);
  if (gap >= 0.45) return 'FOUNDATION';
  if (gap >= 0.2) return 'GUIDED';
  if (gap > -0.1) return 'CORE';
  if (clamp(confidence) < 0.6) return 'CORE';
  return 'CHALLENGE';
}

export function selectAction(diagnosis = {}, { lastCorrect = false, transferScore = null } = {}) {
  if (diagnosis.prerequisiteGaps?.length) return 'REVIEW_PREREQUISITE';
  if (diagnosis.misconception) return 'RETEACH';
  if (!lastCorrect) return diagnosis.mastery < 0.45 ? 'SHOW_EXAMPLE' : 'RETRIEVAL_PRACTICE';
  if (transferScore !== null && transferScore < 0.7) return 'TRANSFER_PRACTICE';
  if (diagnosis.mastery < 0.8) return 'SPACED_REVIEW';
  return 'ADVANCE';
}

export function chooseSource({ sources = [], requiredRights = 'ALLOWED', requiredStatuses = ['SOURCE_VERIFIED', 'SCHOLAR_REVIEWED'] } = {}) {
  return sources
    .filter(source => source?.rightsStatus === requiredRights)
    .filter(source => requiredStatuses.includes(source?.evidenceState))
    .filter(source => source?.sourceId && source?.provenance)
    .sort((a, b) => (Number(b.relevance ?? 0) - Number(a.relevance ?? 0)) || (Number(b.authority ?? 0) - Number(a.authority ?? 0)))
    .map(clone);
}

export function recordLearningOutcome(history, outcome = {}) {
  if (!outcome.skillId || !LEARNING_STAGES.includes(outcome.stage)) throw new TypeError('skillId and valid stage are required');
  const next = [...(history || [])];
  next.push({
    skillId: outcome.skillId,
    stage: outcome.stage,
    correct: outcome.correct === undefined ? null : Boolean(outcome.correct),
    score: outcome.score === undefined ? null : clamp(outcome.score),
    transferScore: outcome.transferScore === undefined ? null : clamp(outcome.transferScore),
    sourceId: outcome.sourceId || null,
    evidenceState: outcome.evidenceState || null,
    provenance: outcome.provenance || null,
    at: outcome.at || null,
  });
  return next;
}

export function scheduleNextReview({ mastery = 0, difficulty = 'CORE', now = new Date().toISOString() } = {}) {
  const baseDays = { FOUNDATION: 1, GUIDED: 2, CORE: 4, CHALLENGE: 7 }[difficulty] ?? 4;
  const multiplier = 0.5 + clamp(mastery);
  const days = Math.max(1, Math.round(baseDays * multiplier));
  const at = new Date(now);
  if (Number.isNaN(at.getTime())) throw new TypeError('invalid now');
  at.setUTCDate(at.getUTCDate() + days);
  return { days, nextReviewAt: at.toISOString() };
}

export function buildAdaptivePlan({ graph, state, skillId, result = {}, sources = [], goal = null } = {}) {
  const diagnosis = diagnoseLearner({ graph, state, skillId, result });
  const difficulty = chooseDifficulty(diagnosis);
  const action = selectAction(diagnosis, { lastCorrect: Boolean(result.correct), transferScore: result.transferScore ?? null });
  const sourceCandidates = chooseSource({ sources });
  const source = sourceCandidates[0] || null;
  const review = scheduleNextReview({ mastery: diagnosis.mastery, difficulty });
  const stage = diagnosis.needsIntervention ? 'DIAGNOSE' : 'RETRIEVE';
  return clone({
    version: V8_VERSION,
    learnerId: state?.learnerId || null,
    skillId,
    goal,
    diagnosis,
    action,
    difficulty,
    recommendedSource: source,
    review,
    nextStage: stage,
    decisionScope: 'LEARNING_ORCHESTRATION_ONLY',
    religiousAuthority: 'UNCHANGED_SOURCE_AND_SCHOLAR_REVIEW_POLICY',
    acquisitionIndependent: true,
  });
}

export function advanceLearningPlan(plan, outcome = {}) {
  if (!plan?.skillId) throw new TypeError('plan.skillId is required');
  const index = LEARNING_STAGES.indexOf(plan.nextStage);
  if (index < 0) throw new TypeError('invalid plan stage');
  const correct = Boolean(outcome.correct);
  let nextStage = LEARNING_STAGES[Math.min(index + 1, LEARNING_STAGES.length - 1)];
  if (!correct && ['RETRIEVE', 'RETRIEVE_AGAIN', 'TEST'].includes(plan.nextStage)) nextStage = plan.action === 'RETEACH' ? 'LEARN' : 'CORRECT';
  if (plan.nextStage === 'CORRECT' && correct) nextStage = 'RETRIEVE_AGAIN';
  if (plan.nextStage === 'TRANSFER' && correct && (outcome.transferScore ?? 0) >= 0.7) nextStage = 'TEST';
  if (plan.nextStage === 'TEST' && correct && (outcome.score ?? 0) >= 0.8) nextStage = 'MASTER';
  return clone({ ...plan, nextStage, lastOutcome: { correct, score: outcome.score ?? null, transferScore: outcome.transferScore ?? null } });
}

export function canAdaptiveLearningDeclareMastery({ plan, score = 0, transferScore = 0, sourceVerified = false, humanReviewRequired = false } = {}) {
  return Boolean(plan?.nextStage === 'TEST' && score >= 0.8 && transferScore >= 0.7 && sourceVerified && !humanReviewRequired);
}

export function createV8AdaptiveLearningEngine(input = {}) {
  return {
    version: V8_VERSION,
    learner: createLearnerState(input.learner),
    policy: {
      targetMastery: 0.75,
      masteryThreshold: 0.8,
      transferThreshold: 0.7,
      rightsRequired: 'ALLOWED',
      sourceEvidenceRequired: true,
      religiousDecisionAuthority: false,
      acquisitionIndependent: true,
    },
  };
}
