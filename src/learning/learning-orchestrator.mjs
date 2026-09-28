import { scheduleWith, createSchedulerState, explainSchedule, retrievabilityFromStability } from './scheduler-registry.mjs';

export const LEARNING_OBJECT_LIFECYCLE = Object.freeze([
  'draft',
  'machine-generated',
  'source-verified',
  'scholar-reviewed',
  'published',
  'deprecated'
]);

export const SELECTION_REASONS = Object.freeze([
  'due',
  'retrievability-risk',
  'recent-error',
  'mastery-gap',
  'prerequisite-gap',
  'confidence-mismatch',
  'novelty',
  'interleaving-value',
  'transfer-value',
  'source-diversity',
  'time-budget'
]);

const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, Number(n) || 0));
const asArray = (value) => Array.isArray(value) ? value : [];
const unique = (value) => [...new Set(asArray(value).filter(Boolean))];

function weightedScore(factors) {
  return Number(Object.values(factors)
    .reduce((sum, entry) => sum + (entry.weight * entry.value), 0)
    .toFixed(6));
}

export function validateLearningObject(item = {}) {
  const errors = [];
  if (!item.itemId) errors.push('itemId is required');
  if (!item.sourceId) errors.push('sourceId is required');
  if (!asArray(item.skillIds).length) errors.push('at least one skillId is required');
  if (!item.provenance || typeof item.provenance !== 'object') errors.push('provenance is required');
  if (!item.provenance?.sourceId) errors.push('provenance.sourceId is required');
  if (!item.provenance?.anchor && !item.provenance?.page && !item.provenance?.location) {
    errors.push('a source anchor, page, or location is required');
  }
  if (item.lifecycle && !LEARNING_OBJECT_LIFECYCLE.includes(item.lifecycle)) errors.push('unsupported lifecycle');
  if (item.lifecycle === 'published' && item.sourceVerified !== true) errors.push('published item must be source-verified');
  if (item.machineGeneratedReligiousAnswer === true && item.sourceVerified !== true) {
    errors.push('machine-generated religious learning object requires verified source');
  }
  return { ok: errors.length === 0, errors };
}

export function buildLearningObject(input = {}) {
  const lifecycle = input.lifecycle ?? (input.machineGenerated ? 'machine-generated' : 'draft');
  const object = {
    itemId: input.itemId ?? null,
    kind: input.kind ?? 'question',
    prompt: input.prompt ?? null,
    answer: input.answer ?? null,
    mode: input.mode ?? 'free-recall',
    skillIds: unique(input.skillIds),
    sourceId: input.sourceId ?? null,
    provenance: {
      sourceId: input.sourceId ?? input.provenance?.sourceId ?? null,
      anchor: input.provenance?.anchor ?? null,
      page: input.provenance?.page ?? null,
      location: input.provenance?.location ?? null,
      sourceVersion: input.provenance?.sourceVersion ?? null,
      verifiedAt: input.provenance?.verifiedAt ?? null
    },
    lifecycle,
    sourceVerified: input.sourceVerified === true,
    scholarlyReview: input.scholarlyReview ?? { required: false, status: 'not-required' },
    invalidated: input.invalidated === true,
    invalidationReason: input.invalidationReason ?? null
  };
  return { object, validation: validateLearningObject(object) };
}

export function invalidateLearningObject(item, reason = 'source-changed') {
  return {
    ...item,
    lifecycle: 'deprecated',
    invalidated: true,
    invalidationReason: reason,
    invalidatedAt: new Date().toISOString()
  };
}

export function applySourceChangeInvalidation(items = [], changedSourceIds = []) {
  const changed = new Set(unique(changedSourceIds));
  return asArray(items).map(item => changed.has(item.sourceId) ? invalidateLearningObject(item) : item);
}

export function createLearnerProfile(input = {}) {
  return {
    learnerId: input.learnerId ?? null,
    contextKey: input.contextKey ?? 'general',
    masteryBySkill: Object.fromEntries(Object.entries(input.masteryBySkill ?? {}).map(([k, v]) => [k, clamp(v)])),
    retrievabilityByItem: Object.fromEntries(Object.entries(input.retrievabilityByItem ?? {}).map(([k, v]) => [k, clamp(v)])),
    confidenceByItem: Object.fromEntries(Object.entries(input.confidenceByItem ?? {}).map(([k, v]) => [k, clamp(v)])),
    errorCounts: { ...(input.errorCounts ?? {}) },
    misconceptionIds: unique(input.misconceptionIds),
    missingPrerequisiteIds: unique(input.missingPrerequisiteIds),
    recentItemIds: unique(input.recentItemIds),
    recentSkillIds: unique(input.recentSkillIds),
    recentModes: unique(input.recentModes),
    sourceCounts: { ...(input.sourceCounts ?? {}) },
    transferHistory: asArray(input.transferHistory),
    delayedAssessmentCount: Number(input.delayedAssessmentCount) || 0
  };
}

function itemMastery(item, profile) {
  if (Number.isFinite(item.mastery)) return clamp(item.mastery);
  const values = unique(item.skillIds).map(skill => profile.masteryBySkill[skill]).filter(Number.isFinite);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function itemRetrievability(item, profile) {
  return clamp(item.retrievability ?? profile.retrievabilityByItem[item.itemId] ?? 0);
}

function sourceDiversityValue(item, profile) {
  const count = Number(profile.sourceCounts[item.sourceId] ?? 0);
  return clamp(1 / (1 + count));
}

export function scoreLearningItem(item, profileInput = {}, options = {}) {
  const profile = createLearnerProfile(profileInput);
  const mastery = itemMastery(item, profile);
  const retrievability = itemRetrievability(item, profile);
  const error = clamp((profile.errorCounts[item.itemId] ?? item.errorRate ?? 0) / Math.max(1, options.errorScale ?? 3));
  const prerequisiteGap = item.prerequisiteMissing === true || unique(item.prerequisiteSkillIds).some(id => profile.missingPrerequisiteIds.includes(id));
  const confidence = clamp(profile.confidenceByItem[item.itemId] ?? item.confidence ?? 0.5);
  const confidenceMismatch = Math.abs(confidence - mastery);
  const novelty = item.novelty ?? (profile.recentItemIds.includes(item.itemId) ? 0 : 0.5);
  const interleavingValue = profile.recentSkillIds.length && unique(item.skillIds).some(id => !profile.recentSkillIds.includes(id)) ? 1 : 0.25;
  const transferValue = clamp(item.transferValue ?? 0);
  const due = item.due === true || (item.nextReviewAt && new Date(item.nextReviewAt).getTime() <= Date.now());
  const timeValue = Number.isFinite(options.timeBudgetMs) && Number.isFinite(item.expectedTimeMs)
    ? clamp(1 - (item.expectedTimeMs / Math.max(1, options.timeBudgetMs)))
    : 0.5;
  const sourceDiversity = sourceDiversityValue(item, profile);

  const factors = {
    due: { value: due ? 1 : 0, weight: 0.2 },
    'retrievability-risk': { value: 1 - retrievability, weight: 0.22 },
    'recent-error': { value: error, weight: 0.13 },
    'mastery-gap': { value: 1 - mastery, weight: 0.15 },
    'prerequisite-gap': { value: prerequisiteGap ? 1 : 0, weight: 0.1 },
    'confidence-mismatch': { value: confidenceMismatch, weight: 0.06 },
    novelty: { value: clamp(novelty), weight: 0.03 },
    'interleaving-value': { value: clamp(interleavingValue), weight: 0.04 },
    'transfer-value': { value: transferValue, weight: 0.03 },
    'source-diversity': { value: sourceDiversity, weight: 0.02 },
    'time-budget': { value: timeValue, weight: 0.02 }
  };
  const reasons = Object.entries(factors)
    .filter(([, f]) => f.value >= 0.55)
    .sort((a, b) => (b[1].value * b[1].weight) - (a[1].value * a[1].weight))
    .map(([reason]) => reason);

  return {
    item,
    score: weightedScore(factors),
    reasons: reasons.length ? reasons : ['balanced-practice'],
    metrics: { mastery, retrievability, confidence, confidenceMismatch, error, prerequisiteGap, novelty, interleavingValue, transferValue, sourceDiversity, timeValue }
  };
}

export function chooseTargetDifficulty(item, profileInput = {}) {
  const profile = createLearnerProfile(profileInput);
  const mastery = itemMastery(item, profile);
  const error = Number(profile.errorCounts[item.itemId] ?? item.errorRate ?? 0);
  const confidence = clamp(profile.confidenceByItem[item.itemId] ?? item.confidence ?? 0.5);
  const gap = confidence - mastery;

  let level = 'medium';
  if (error >= 0.5 || mastery < 0.3) level = 'easy';
  else if (mastery > 0.78 && error < 0.2) level = 'hard';

  if (gap > 0.3 && level === 'hard') level = 'medium';
  return level;
}

export function chooseMode(item, profileInput = {}, options = {}) {
  const profile = createLearnerProfile(profileInput);
  const available = unique(options.modes ?? [
    item.mode ?? 'free-recall',
    'free-recall',
    'recognition',
    'cued-recall',
    'cloze',
    'short-answer',
    'explain',
    'source-match',
    'concept-evidence',
    'compare-contrast',
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

  if (profile.missingPrerequisiteIds.length && available.includes('source-match')) return { mode: 'source-match', reason: 'prerequisite-gap' };
  const confidence = clamp(profile.confidenceByItem[item.itemId] ?? item.confidence ?? 0.5);
  const mastery = itemMastery(item, profile);
  if (Math.abs(confidence - mastery) >= 0.3 && available.includes('confidence-prediction')) return { mode: 'confidence-prediction', reason: 'confidence-mismatch' };
  if ((profile.errorCounts[item.itemId] ?? 0) >= 2 && available.includes('error-correction')) return { mode: 'error-correction', reason: 'recent-error' };
  if (mastery >= 0.7 && available.includes('transfer')) return { mode: 'transfer', reason: 'transfer-value' };
  if (available.includes('free-recall') && !profile.recentModes.includes('free-recall')) return { mode: 'free-recall', reason: 'active-retrieval' };

  const unseen = available.find(mode => !profile.recentModes.includes(mode));
  return { mode: unseen ?? available[0] ?? 'free-recall', reason: 'balanced-practice' };
}

export function interleaveItems(items = [], profileInput = {}) {
  const profile = createLearnerProfile(profileInput);
  const scored = asArray(items).map(item => scoreLearningItem(item, profile));
  const remaining = [...scored];
  const result = [];
  let previousSkillIds = new Set(profile.recentSkillIds);

  while (remaining.length) {
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < remaining.length; i += 1) {
      const entry = remaining[i];
      const overlap = unique(entry.item.skillIds).some(id => previousSkillIds.has(id)) ? 1 : 0;
      const penalty = overlap && remaining.length > 1 ? 0.08 : 0;
      const candidateScore = entry.score - penalty;
      if (candidateScore > bestScore) {
        bestScore = candidateScore;
        bestIndex = i;
      }
    }
    const [chosen] = remaining.splice(bestIndex, 1);
    result.push(chosen.item);
    previousSkillIds = new Set(unique(chosen.item.skillIds));
  }
  return result;
}

export function buildSelectionDecision({ item, profile = {}, candidates = [], scheduler = 'fsrs', now, deadlineAt, timeBudgetMs } = {}) {
  if (!item) throw new Error('item is required');
  const validation = validateLearningObject(item);
  if (!validation.ok) throw new Error('invalid learning object: ' + validation.errors.join(', '));

  const scoredPool = [item, ...asArray(candidates)]
    .filter((candidate, index, all) => candidate && all.findIndex(x => x.itemId === candidate.itemId) === index)
    .map(candidate => scoreLearningItem(candidate, profile, { timeBudgetMs }));

  const selected = scoredPool.sort((a, b) => b.score - a.score)[0];
  const learner = createLearnerProfile(profile);
  const mode = chooseMode(selected.item, learner);
  const targetDifficulty = chooseTargetDifficulty(selected.item, learner);
  const schedulerState = createSchedulerState({
    algorithm: scheduler,
    contextKey: learner.contextKey,
    ...(profile.schedulerState?.[selected.item.itemId] ?? {})
  });

  const review = scheduleWith(scheduler, {
    state: schedulerState,
    grade: 'good',
    now,
    deadlineAt
  });

  const reasons = unique([
    ...selected.reasons,
    mode.reason,
    review.reason
  ]).filter(reason => SELECTION_REASONS.includes(reason) || ['active-retrieval', 'balanced-practice', 'successful-retrieval'].includes(reason));

  return {
    itemId: selected.item.itemId,
    skillIds: unique(selected.item.skillIds),
    sourceIds: [selected.item.sourceId],
    mode: mode.mode,
    reason: reasons.length ? reasons : ['balanced-practice'],
    predictedRetrievability: selected.metrics.retrievability,
    targetDifficulty,
    nextReview: review.nextReviewAt,
    confidencePrompt: true,
    transferAfter: selected.metrics.mastery >= 0.65 || selected.metrics.transferValue >= 0.5,
    scheduleExplanation: explainSchedule(review),
    score: selected.score,
    acquisitionIndependent: true
  };
}

export function recordLearningEvent(input = {}) {
  const event = {
    schemaVersion: '1.0.0',
    eventId: input.eventId ?? null,
    timestamp: input.timestamp ?? new Date().toISOString(),
    learnerId: input.learnerId ?? null,
    contextKey: input.contextKey ?? 'general',
    itemId: input.itemId ?? null,
    skillIds: unique(input.skillIds),
    sourceId: input.sourceId ?? null,
    sourceAnchor: input.sourceAnchor ?? null,
    mode: input.mode ?? null,
    decisionReasons: unique(input.decisionReasons),
    targetDifficulty: input.targetDifficulty ?? null,
    correctness: input.correctness === null || input.correctness === undefined ? null : Boolean(input.correctness),
    confidence: input.confidence === null || input.confidence === undefined ? null : clamp(input.confidence),
    responseTimeMs: Number.isFinite(input.responseTimeMs) ? input.responseTimeMs : null,
    feedbackShown: input.feedbackShown ?? null,
    misconceptionIds: unique(input.misconceptionIds),
    prerequisiteIds: unique(input.prerequisiteIds),
    gameEvent: input.gameEvent ?? null,
    nextReview: input.nextReview ?? null,
    delayedAssessment: input.delayedAssessment ?? null,
    transferAssessment: input.transferAssessment ?? null,
    provenance: input.provenance ?? {
      sourceId: input.sourceId ?? null,
      anchor: input.sourceAnchor ?? null
    }
  };
  if (!event.itemId || !event.sourceId || !event.skillIds.length) {
    throw new Error('learning event requires itemId, sourceId, and skillIds');
  }
  return event;
}

export function updateLearnerFromEvent(profileInput = {}, event = {}) {
  const profile = createLearnerProfile(profileInput);
  const next = createLearnerProfile(profile);
  if (event.correctness !== null && event.correctness !== undefined) {
    const itemId = event.itemId;
    const priorMastery = itemId && profile.masteryBySkill[event.skillIds?.[0]] !== undefined
      ? profile.masteryBySkill[event.skillIds[0]]
      : 0.5;
    const delta = event.correctness ? 0.08 : -0.06;
    for (const skillId of unique(event.skillIds)) {
      next.masteryBySkill[skillId] = clamp(priorMastery + delta);
    }
    if (!event.correctness) next.errorCounts[itemId] = Number(next.errorCounts[itemId] ?? 0) + 1;
  }
  if (event.confidence !== null && event.confidence !== undefined && event.itemId) {
    next.confidenceByItem[event.itemId] = clamp(event.confidence);
  }
  next.recentItemIds = [event.itemId, ...next.recentItemIds.filter(id => id !== event.itemId)].slice(0, 20);
  next.recentSkillIds = unique([...event.skillIds, ...next.recentSkillIds]).slice(0, 20);
  if (event.mode) next.recentModes = unique([event.mode, ...next.recentModes]).slice(0, 10);
  return next;
}

export function delayedMasteryEligible(profileInput = {}, { delayed = false, transfer = false } = {}) {
  const profile = createLearnerProfile(profileInput);
  return Boolean((delayed || transfer) && profile.delayedAssessmentCount >= 0);
}

export function createLearningTrace({ source, learningObject, decision, event, followUp } = {}) {
  return {
    traceVersion: '1.0.0',
    source: source ?? null,
    learningObject: learningObject ?? null,
    selection: decision ?? null,
    response: event ?? null,
    followUp: followUp ?? null,
    acquisitionIndependent: true
  };
}

export function createLearningOrchestrator(options = {}) {
  const scheduler = options.scheduler ?? 'fsrs';
  const stateByContext = new Map();

  return Object.freeze({
    scheduler,
    select(item, profile = {}, context = {}) {
      const key = context.contextKey ?? profile.contextKey ?? 'general';
      return buildSelectionDecision({
        item,
        candidates: context.candidates ?? [],
        profile: { ...profile, contextKey: key, schedulerState: { ...(profile.schedulerState ?? {}), [item.itemId]: stateByContext.get(key)?.[item.itemId] } },
        scheduler,
        now: context.now,
        deadlineAt: context.deadlineAt,
        timeBudgetMs: context.timeBudgetMs
      });
    },
    schedule(itemId, profile = {}, grade = 'good', context = {}) {
      const key = context.contextKey ?? profile.contextKey ?? 'general';
      const current = stateByContext.get(key) ?? {};
      const state = current[itemId] ?? createSchedulerState({ algorithm: scheduler, contextKey: key });
      const result = scheduleWith(scheduler, { state, grade, now: context.now, deadlineAt: context.deadlineAt });
      stateByContext.set(key, { ...current, [itemId]: result.state });
      return result;
    },
    getContextState(contextKey = 'general') {
      return stateByContext.get(contextKey) ?? {};
    },
    clearContext(contextKey = 'general') {
      stateByContext.delete(contextKey);
    }
  });
}

export function calculateRetrievability({ stabilityDays = 1, elapsedDays = 0 } = {}) {
  return retrievabilityFromStability({ stabilityDays, elapsedDays });
}
