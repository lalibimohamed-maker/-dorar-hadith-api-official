/**
 * Rechercher Learning Intelligence v3
 *
 * Educational enrichment is strictly downstream and non-blocking for
 * acquisition. This module stores only explainable learning state and
 * source-grounded learning contracts; it never mutates Corpus content.
 */

export const LEARNING_METHODS = Object.freeze([
  'retrieval',
  'spacing',
  'interleaving',
  'worked_example',
  'self_explanation',
  'teach_back',
  'comparison',
  'source_criticism',
  'transfer',
  'reading',
  'audio',
  'visual',
  'game'
]);

export const LEARNING_PIPELINE = Object.freeze([
  'diagnose',
  'prerequisites',
  'source_grounded_explanation',
  'worked_example',
  'retrieval',
  'feedback',
  'spacing',
  'interleaving',
  'self_explanation',
  'teach_back',
  'transfer',
  'adapt'
]);

const VALID_MODALITIES = new Set(['text', 'audio', 'visual', 'spoken']);
const VERIFIED_SOURCE_STATES = new Set(['source_verified', 'edition_verified', 'scholar_reviewed']);

function bounded(value, min = 0, max = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function nonNegative(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function createLearnerProfile(input = {}) {
  const allowedLanguages = Array.isArray(input.languages) ? input.languages.filter(Boolean) : [];
  return Object.freeze({
    learnerId: input.learnerId ?? null,
    goals: Array.isArray(input.goals) ? [...input.goals] : [],
    languages: allowedLanguages,
    interfaceLanguage: input.interfaceLanguage ?? null,
    learningLanguage: input.learningLanguage ?? null,
    mastery: Object.freeze({ ...(input.mastery || {}) }),
    prerequisites: Object.freeze({ ...(input.prerequisites || {}) }),
    retrievalStrength: Object.freeze({ ...(input.retrievalStrength || {}) }),
    recentErrors: Object.freeze({ ...(input.recentErrors || {}) }),
    confidence: Object.freeze({ ...(input.confidence || {}) }),
    learningHistory: Object.freeze(Array.isArray(input.learningHistory) ? [...input.learningHistory] : []),
    sourceProgress: Object.freeze({ ...(input.sourceProgress || {}) }),
    preferredModality: VALID_MODALITIES.has(input.preferredModality) ? input.preferredModality : 'text',
    sensitiveProfiling: false
  });
}

export function recordLearningOutcome(state = {}, outcome = {}) {
  const skill = String(outcome.skill || '').trim();
  if (!skill) throw new TypeError('skill is required');
  const correct = outcome.correct === true;
  const confidence = bounded(outcome.confidence);
  const previous = state.mastery?.[skill] ?? 0;
  const delta = correct ? 0.12 : -0.08;
  const mastery = bounded(previous + delta);
  return {
    ...state,
    mastery: { ...(state.mastery || {}), [skill]: mastery },
    retrievalStrength: {
      ...(state.retrievalStrength || {}),
      [skill]: bounded(((state.retrievalStrength?.[skill] ?? 0) * 0.7) + (correct ? 0.3 : 0))
    },
    recentErrors: {
      ...(state.recentErrors || {}),
      [skill]: correct ? 0 : nonNegative((state.recentErrors?.[skill] ?? 0) + 1)
    },
    confidence: {
      ...(state.confidence || {}),
      [skill]: confidence
    },
    learningHistory: [
      ...(state.learningHistory || []),
      {
        skill,
        correct,
        confidence,
        timestamp: outcome.timestamp ?? null
      }
    ]
  };
}

export function confidenceCalibration(state = {}, skill) {
  const history = (state.learningHistory || []).filter((item) => item.skill === skill);
  if (!history.length) return { skill, observations: 0, bias: 0, overconfidenceRisk: 0, underconfidenceRisk: 0 };
  const meanConfidence = history.reduce((sum, item) => sum + bounded(item.confidence), 0) / history.length;
  const meanCorrect = history.reduce((sum, item) => sum + (item.correct ? 1 : 0), 0) / history.length;
  const bias = meanConfidence - meanCorrect;
  return {
    skill,
    observations: history.length,
    meanConfidence,
    meanCorrect,
    bias,
    overconfidenceRisk: bounded(Math.max(bias, 0)),
    underconfidenceRisk: bounded(Math.max(-bias, 0))
  };
}

export function createSourceGroundedLearningObject({
  id,
  type = 'lesson',
  sourcePassages = [],
  conceptIds = [],
  method = 'retrieval',
  generatedAssistance = null
} = {}) {
  if (!id || !Array.isArray(sourcePassages) || sourcePassages.length === 0) {
    throw new TypeError('learning object requires an id and source passages');
  }
  if (!LEARNING_METHODS.includes(method)) throw new TypeError(`Unsupported learning method: ${method}`);

  const validPassages = sourcePassages.every((passage) =>
    passage &&
    passage.sourceId &&
    passage.citation &&
    Object.prototype.hasOwnProperty.call(passage, 'rights') &&
    passage.rights !== null &&
    VERIFIED_SOURCE_STATES.has(passage.verificationState)
  );
  if (!validPassages) throw new TypeError('learning object requires verified source-grounded passages');

  return Object.freeze({
    id,
    type,
    conceptIds: Object.freeze([...conceptIds]),
    method,
    sourcePassages: Object.freeze(sourcePassages.map((item) => Object.freeze({ ...item }))),
    generatedAssistance,
    generatedIsEvidence: false,
    canonicalCorpusMutation: false
  });
}

export function diagnoseLearner({ skill, state = {} } = {}) {
  const mastery = bounded(state.mastery?.[skill]);
  const errors = nonNegative(state.recentErrors?.[skill]);
  const calibration = confidenceCalibration(state, skill);
  const prerequisiteGap = bounded(state.prerequisites?.[skill]?.gap ?? 0);
  return {
    skill,
    mastery,
    retrievalRisk: bounded(1 - bounded(state.retrievalStrength?.[skill])),
    errorRate: bounded(errors / Math.max((state.learningHistory || []).filter((item) => item.skill === skill).length, 1)),
    prerequisiteGap,
    calibration,
    needsPractice: mastery < 0.75 || prerequisiteGap > 0.25 || errors > 0
  };
}

export function selectNextActivity(diagnosis, {
  preferredModality = 'text',
  dueReview = false,
  transferValue = 0,
  sourceAvailable = true
} = {}) {
  if (!sourceAvailable) {
    return Object.freeze({
      allowed: false,
      acquisitionBlocking: false,
      reason: 'source-unavailable',
      method: null
    });
  }

  let method = 'retrieval';
  let reason = ['retrieval'];

  if (diagnosis.prerequisiteGap > 0.4) {
    method = 'reading';
    reason = ['prerequisite-gap'];
  } else if (diagnosis.calibration.overconfidenceRisk > 0.25) {
    method = 'source_criticism';
    reason = ['confidence-mismatch'];
  } else if (diagnosis.retrievalRisk > 0.45 || dueReview) {
    method = 'spacing';
    reason = ['retrieval-risk', 'due-review'];
  } else if (Number(transferValue) > 0.5) {
    method = 'transfer';
    reason = ['transfer-value'];
  } else if (diagnosis.mastery >= 0.45 && diagnosis.mastery < 0.75) {
    method = 'worked_example';
    reason = ['developing-mastery'];
  }

  return Object.freeze({
    allowed: true,
    acquisitionBlocking: false,
    method,
    modality: VALID_MODALITIES.has(preferredModality) ? preferredModality : 'text',
    reason,
    explainability: 'inspectable'
  });
}

export function evaluateLearningIntervention({
  immediateAccuracy = null,
  delayedAccuracy = null,
  transferAccuracy = null,
  confidenceBias = 0
} = {}) {
  const values = [immediateAccuracy, delayedAccuracy, transferAccuracy].filter((value) => value !== null && value !== undefined);
  return Object.freeze({
    immediateAccuracy: immediateAccuracy === null ? null : bounded(immediateAccuracy),
    delayedAccuracy: delayedAccuracy === null ? null : bounded(delayedAccuracy),
    transferAccuracy: transferAccuracy === null ? null : bounded(transferAccuracy),
    confidenceBias: Number.isFinite(Number(confidenceBias)) ? Number(confidenceBias) : 0,
    durableLearningMeasured: values.length >= 2,
    acquisitionBlocking: false
  });
}

export function canLearningFailureBlockAcquisition() {
  return false;
}
