import { loadFlashcardConfig } from './flashcard-engine.mjs';

/**
 * Rechercher Learning Intelligence Engine v1.
 *
 * The engine is intentionally source-first and acquisition-independent:
 * learning enrichment may fail or be unavailable without blocking PDF
 * acquisition, preservation, rights processing, or corpus discovery.
 */

export const ENGINE_ID = 'rechercher-learning-intelligence-v1';
export const ENGINE_VERSION = '1.0.0';

export const LEARNING_LOOP = Object.freeze([
  'know',
  'forget',
  'error',
  'prerequisite',
  'select_method',
  'render',
  'feedback',
  'wait',
  'retest',
  'transfer',
  'replan'
]);

export const PRACTICE_MODES = Object.freeze([
  'free-recall',
  'recognition',
  'cued-recall',
  'cloze',
  'short-answer',
  'explain',
  'compare-contrast',
  'source-match',
  'concept-evidence',
  'chronology',
  'classification',
  'error-correction',
  'confidence-prediction',
  'teach-back',
  'transfer',
  'audio-recall',
  'visual-recall',
  'game'
]);

const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, Number(n) || 0));

function weightedMean(values) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
}

/** Build a learner state without pretending that correctness equals mastery. */
export function createLearnerState(input = {}) {
  const mastery = clamp(input.mastery);
  const retrievability = clamp(input.retrievability ?? mastery);
  const confidence = clamp(input.confidence);
  const errorRate = clamp(input.errorRate);
  return {
    learnerId: input.learnerId ?? null,
    skillIds: [...new Set(input.skillIds ?? [])],
    mastery,
    retrievability,
    confidence,
    errorRate,
    confidenceGap: Number((confidence - mastery).toFixed(4)),
    misconceptionIds: [...new Set(input.misconceptionIds ?? [])],
    missingPrerequisiteIds: [...new Set(input.missingPrerequisiteIds ?? [])],
    recentModes: [...new Set(input.recentModes ?? [])],
    context: input.context ?? 'general',
    updatedAt: input.updatedAt ?? new Date().toISOString()
  };
}

/** Diagnose why an answer was weak; callers can supply richer evidence later. */
export function diagnosePerformance({ correct = false, confidence = 0, responseTimeMs = null, expectedTimeMs = null, prerequisiteMissing = false, misconception = false } = {}) {
  const c = clamp(confidence);
  const reasons = [];
  if (!correct && c >= 0.7) reasons.push('misconception-or-overconfidence');
  if (!correct && c < 0.4) reasons.push('retrieval-failure-or-knowledge-gap');
  if (prerequisiteMissing) reasons.push('missing-prerequisite');
  if (misconception) reasons.push('known-misconception');
  if (Number.isFinite(responseTimeMs) && Number.isFinite(expectedTimeMs) && responseTimeMs > expectedTimeMs * 2) reasons.push('slow-retrieval');
  if (correct && c < 0.4) reasons.push('underconfidence');
  return {
    correct,
    confidence: c,
    reasons: reasons.length ? reasons : ['no-dominant-diagnosis'],
    severity: correct ? (c < 0.4 ? 'low' : 'normal') : (c >= 0.7 ? 'high' : 'medium')
  };
}

/** Select the next educational action using transparent, inspectable signals. */
export function selectLearningMethod(state, options = {}) {
  const s = createLearnerState(state);
  const candidates = options.candidates ?? PRACTICE_MODES;
  const hasPrerequisiteGap = s.missingPrerequisiteIds.length > 0;
  const overconfident = s.confidenceGap > 0.25;
  const underconfident = s.confidenceGap < -0.25;
  const weak = s.mastery < 0.5 || s.retrievability < 0.45;
  const recent = new Set(s.recentModes);

  if (hasPrerequisiteGap && candidates.includes('source-match')) return { mode: 'source-match', reason: 'prerequisite-gap' };
  if (overconfident && candidates.includes('confidence-prediction')) return { mode: 'confidence-prediction', reason: 'calibration-gap' };
  if (weak && candidates.includes('free-recall')) return { mode: 'free-recall', reason: 'retrieval-strengthening' };
  if (s.errorRate > 0.35 && candidates.includes('error-correction')) return { mode: 'error-correction', reason: 'recent-error-pattern' };
  if (s.mastery >= 0.65 && candidates.includes('transfer')) return { mode: 'transfer', reason: 'transfer-check' };

  const unseen = candidates.find(mode => !recent.has(mode));
  return { mode: unseen ?? candidates[0] ?? 'free-recall', reason: 'balanced-practice' };
}

/** Pick an item by learning value rather than by random card order. */
export function selectNextItem(items = [], state = {}) {
  const s = createLearnerState(state);
  return [...items]
    .map(item => {
      const masteryGap = 1 - clamp(item.mastery ?? s.mastery);
      const retrievalRisk = 1 - clamp(item.retrievability ?? s.retrievability);
      const prerequisite = item.prerequisiteMissing ? 1 : 0;
      const novelty = item.novelty ?? 0;
      const transfer = item.transferValue ?? 0;
      const recencyPenalty = s.recentModes.includes(item.mode) ? 0.15 : 0;
      const score = 0.35 * retrievalRisk + 0.30 * masteryGap + 0.15 * prerequisite + 0.10 * novelty + 0.10 * transfer - recencyPenalty;
      return { item, score };
    })
    .sort((a, b) => b.score - a.score)[0]?.item ?? null;
}

/** Transparent scheduler abstraction: FSRS/SM-2/Leitner can plug in behind this contract. */
export function scheduleReview({ retrievability = 0.5, difficulty = 0.5, correct = false, now = new Date(), minMinutes = 10 } = {}) {
  const r = clamp(retrievability);
  const d = clamp(difficulty);
  const baseMinutes = 10 + 1440 * Math.max(0.05, r) * (1 - 0.55 * d);
  const multiplier = correct ? 1.35 : 0.22;
  const minutes = Math.max(minMinutes, Math.round(baseMinutes * multiplier));
  return {
    scheduler: 'rechercher-adapter-v1',
    compatibleBackends: ['FSRS', 'SM-2', 'Leitner', 'forgetting-curve'],
    nextReviewAt: new Date(new Date(now).getTime() + minutes * 60000).toISOString(),
    minutes,
    reason: correct ? 'successful-retrieval' : 'failed-retrieval'
  };
}

export function buildLearningDecision({ itemId, skillIds = [], sourceIds = [], state = {}, candidates, now } = {}) {
  const learner = createLearnerState(state);
  const method = selectLearningMethod(learner, { candidates });
  return {
    engineId: ENGINE_ID,
    engineVersion: ENGINE_VERSION,
    itemId: itemId ?? null,
    skillIds,
    sourceIds,
    mode: method.mode,
    reason: method.reason,
    predictedRetrievability: learner.retrievability,
    targetDifficulty: clamp(0.5 + learner.errorRate * 0.4),
    confidencePrompt: true,
    transferAfter: learner.mastery >= 0.65,
    review: scheduleReview({ retrievability: learner.retrievability, difficulty: 0.5, correct: false, now })
  };
}

export function updateAfterAttempt(state, attempt = {}) {
  const before = createLearnerState(state);
  const correct = Boolean(attempt.correct);
  const confidence = clamp(attempt.confidence ?? before.confidence);
  const masteryDelta = correct ? 0.08 : -0.05;
  const mastery = clamp(before.mastery + masteryDelta);
  const retrievability = clamp(correct ? Math.max(before.retrievability, mastery) : before.retrievability * 0.65);
  const errorRate = clamp(before.errorRate * 0.85 + (correct ? 0 : 0.15));
  return createLearnerState({
    ...before,
    mastery,
    retrievability,
    confidence,
    errorRate,
    updatedAt: new Date().toISOString()
  });
}

export function evaluateTransfer({ correct = false, confidence = 0, novelContext = false, explanationQuality = 0 } = {}) {
  return {
    correct: Boolean(correct),
    confidence: clamp(confidence),
    novelContext: Boolean(novelContext),
    explanationQuality: clamp(explanationQuality),
    transferred: Boolean(correct && novelContext && explanationQuality >= 0.5),
    evidence: ['delayed-or-novel-context-performance', 'explanation-quality', 'confidence']
  };
}

export function runLearningCycle({ state = {}, attempt = {}, items = [] } = {}) {
  const diagnosis = diagnosePerformance(attempt);
  const nextState = updateAfterAttempt(state, attempt);
  const method = selectLearningMethod(nextState);
  const nextItem = selectNextItem(items, nextState);
  return {
    engineId: ENGINE_ID,
    loop: LEARNING_LOOP,
    diagnosis,
    state: nextState,
    next: { method, item: nextItem },
    acquisitionIndependent: true
  };
}

export function getLearningEngineCapabilities() {
  const flashcards = loadFlashcardConfig();
  return {
    engineId: ENGINE_ID,
    version: ENGINE_VERSION,
    loop: [...LEARNING_LOOP],
    practiceModes: [...PRACTICE_MODES],
    schedulerBackends: ['FSRS', 'SM-2', 'Leitner', 'forgetting-curve'],
    renderers: ['card', 'reading', 'audio', 'visual', 'game'],
    flashcardQuestionModes: flashcards.questionModes ?? [],
    acquisitionBlocking: false,
    sourceGroundingRequiredForReligiousAnswers: true,
    scholarReviewSupported: true
  };
}
