/**
 * Unified scheduler contract for Rechercher Learning Orchestrator.
 *
 * The FSRS adapter exposes FSRS-shaped state variables (stability, difficulty,
 * retrievability) without claiming canonical reference parity.
 */

export const SCHEDULER_IDS = Object.freeze([
  'fsrs',
  'sm2',
  'leitner',
  'forgetting-curve',
  'deadline-aware'
]);

const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, Number(n) || 0));
const asDate = (value) => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value ?? Date.now());
  return Number.isNaN(date.getTime()) ? new Date() : date;
};
const round = (n, digits = 4) => Number(Number(n).toFixed(digits));

export function retrievabilityFromStability({ stabilityDays = 1, elapsedDays = 0 } = {}) {
  const stability = Math.max(0.01, Number(stabilityDays) || 1);
  const elapsed = Math.max(0, Number(elapsedDays) || 0);
  return clamp(Math.exp(-elapsed / stability));
}

export function createSchedulerState(input = {}) {
  return {
    algorithm: input.algorithm ?? 'fsrs',
    contextKey: input.contextKey ?? 'general',
    repetitions: Math.max(0, Number(input.repetitions) || 0),
    stabilityDays: Math.max(0.1, Number(input.stabilityDays) || 1),
    difficulty: clamp(input.difficulty ?? 0.5),
    retrievability: clamp(input.retrievability ?? 1),
    intervalDays: Math.max(0, Number(input.intervalDays) || 0),
    easeFactor: Math.max(1.3, Number(input.easeFactor) || 2.5),
    leitnerBox: Math.max(1, Math.min(5, Number(input.leitnerBox) || 1)),
    lastReviewedAt: input.lastReviewedAt ?? null,
    nextReviewAt: input.nextReviewAt ?? null
  };
}

function gradeToScore(grade) {
  if (typeof grade === 'string') {
    const map = { again: 1, hard: 2, good: 3, easy: 4 };
    return map[grade.toLowerCase()] ?? 3;
  }
  return Math.max(1, Math.min(4, Number(grade) || 3));
}

export function fsrsSchedule(input = {}) {
  const state = createSchedulerState({ ...input.state, algorithm: 'fsrs' });
  const grade = gradeToScore(input.grade);
  const now = asDate(input.now);
  const initial = state.repetitions === 0;

  let difficulty = state.difficulty || 0.5;
  let stability = Math.max(0.1, state.stabilityDays || 1);

  if (grade === 1) {
    stability = Math.max(0.1, stability * (0.35 - 0.15 * difficulty));
    difficulty = clamp(difficulty + 0.08);
  } else if (grade === 2) {
    stability = Math.max(0.2, stability * (0.82 - 0.08 * difficulty));
    difficulty = clamp(difficulty + 0.025);
  } else if (grade === 3) {
    stability = Math.max(0.5, initial ? 1 : stability * (1.45 + (1 - difficulty) * 0.35));
    difficulty = clamp(difficulty - 0.01);
  } else {
    stability = Math.max(0.75, initial ? 2 : stability * (1.9 + (1 - difficulty) * 0.55));
    difficulty = clamp(difficulty - 0.04);
  }

  const requestedRetrievability = clamp(input.targetRetrievability ?? 0.9, 0.5, 0.98);
  let intervalDays = Math.max(0.04, -stability * Math.log(requestedRetrievability));
  if (grade === 1) intervalDays = Math.min(intervalDays, 0.03);
  if (grade === 2) intervalDays = Math.min(intervalDays, 0.5);
  if (grade === 4) intervalDays *= 1.12;

  const nextReviewAt = new Date(now.getTime() + intervalDays * 86400000);
  return {
    scheduler: 'fsrs',
    algorithmFamily: 'fsrs',
    implementation: 'rechercher-fsrs-compatible-v1',
    canonicalImplementation: false,
    grade,
    state: createSchedulerState({
      ...state,
      algorithm: 'fsrs',
      repetitions: state.repetitions + (grade === 1 ? 0 : 1),
      stabilityDays: round(stability, 3),
      difficulty: round(difficulty),
      retrievability: 1,
      intervalDays: round(intervalDays, 3),
      lastReviewedAt: now.toISOString(),
      nextReviewAt: nextReviewAt.toISOString()
    }),
    nextReviewAt: nextReviewAt.toISOString(),
    reason: grade === 1 ? 'failed-retrieval' : grade === 2 ? 'hard-retrieval' : 'successful-retrieval'
  };
}

export function sm2Schedule(input = {}) {
  const state = createSchedulerState({ ...input.state, algorithm: 'sm2' });
  const grade = gradeToScore(input.grade);
  const now = asDate(input.now);
  let easeFactor = state.easeFactor;
  let repetitions = state.repetitions;
  let intervalDays = state.intervalDays;

  if (grade < 3) {
    repetitions = 0;
    intervalDays = 0.04;
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = intervalDays * easeFactor;
    easeFactor = Math.max(
      1.3,
      easeFactor + (0.1 - (4 - grade) * (0.08 + (4 - grade) * 0.02))
    );
  }

  const nextReviewAt = new Date(now.getTime() + intervalDays * 86400000);
  return {
    scheduler: 'sm2',
    algorithmFamily: 'supermemo-sm2',
    implementation: 'rechercher-sm2-reference-v1',
    canonicalImplementation: false,
    grade,
    state: createSchedulerState({
      ...state,
      algorithm: 'sm2',
      repetitions,
      intervalDays: round(intervalDays, 3),
      easeFactor: round(easeFactor),
      lastReviewedAt: now.toISOString(),
      nextReviewAt: nextReviewAt.toISOString()
    }),
    nextReviewAt: nextReviewAt.toISOString(),
    reason: grade < 3 ? 'reset-after-failure' : 'sm2-success'
  };
}

const LEITNER_INTERVALS_DAYS = Object.freeze({ 1: 0.04, 2: 1, 3: 3, 4: 7, 5: 14 });

export function leitnerSchedule(input = {}) {
  const state = createSchedulerState({ ...input.state, algorithm: 'leitner' });
  const grade = gradeToScore(input.grade);
  const now = asDate(input.now);
  let box = state.leitnerBox;
  if (grade <= 1) box = 1;
  else if (grade === 2) box = Math.max(1, box - 1);
  else if (grade === 4) box = Math.min(5, box + 1);

  const intervalDays = LEITNER_INTERVALS_DAYS[box];
  const nextReviewAt = new Date(now.getTime() + intervalDays * 86400000);
  return {
    scheduler: 'leitner',
    algorithmFamily: 'leitner',
    implementation: 'rechercher-leitner-v1',
    canonicalImplementation: true,
    grade,
    state: createSchedulerState({
      ...state,
      algorithm: 'leitner',
      leitnerBox: box,
      intervalDays,
      repetitions: state.repetitions + (grade > 1 ? 1 : 0),
      lastReviewedAt: now.toISOString(),
      nextReviewAt: nextReviewAt.toISOString()
    }),
    nextReviewAt: nextReviewAt.toISOString(),
    reason: grade <= 1 ? 'return-to-box-1' : 'move-through-boxes'
  };
}

export function forgettingCurveSchedule(input = {}) {
  const state = createSchedulerState({ ...input.state, algorithm: 'forgetting-curve' });
  const grade = gradeToScore(input.grade);
  const now = asDate(input.now);
  const stabilityDays = Math.max(0.25, state.stabilityDays || 1);
  const targetRetrievability = clamp(input.targetRetrievability ?? (grade >= 3 ? 0.85 : 0.95), 0.5, 0.99);
  let intervalDays = Math.max(0.03, -stabilityDays * Math.log(targetRetrievability));
  if (grade === 1) intervalDays = Math.min(intervalDays, 0.03);
  if (grade === 2) intervalDays = Math.min(intervalDays, 0.5);

  const nextReviewAt = new Date(now.getTime() + intervalDays * 86400000);
  return {
    scheduler: 'forgetting-curve',
    algorithmFamily: 'forgetting-curve',
    implementation: 'exponential-retention-v1',
    canonicalImplementation: true,
    grade,
    state: createSchedulerState({
      ...state,
      algorithm: 'forgetting-curve',
      intervalDays: round(intervalDays, 3),
      retrievability: 1,
      lastReviewedAt: now.toISOString(),
      nextReviewAt: nextReviewAt.toISOString()
    }),
    nextReviewAt: nextReviewAt.toISOString(),
    reason: 'target-retrievability'
  };
}

export function deadlineAwareSchedule(input = {}) {
  const baseScheduler = input.baseScheduler ?? 'fsrs';
  const deadline = input.deadlineAt ? asDate(input.deadlineAt) : null;
  const now = asDate(input.now);
  let base;
  if (baseScheduler === 'sm2') base = sm2Schedule(input);
  else if (baseScheduler === 'leitner') base = leitnerSchedule(input);
  else if (baseScheduler === 'forgetting-curve') base = forgettingCurveSchedule(input);
  else base = fsrsSchedule(input);

  if (!deadline) return { ...base, scheduler: 'deadline-aware', baseScheduler };

  const deadlineMs = Math.max(0, deadline.getTime() - now.getTime());
  const baseMs = Math.max(0, new Date(base.nextReviewAt).getTime() - now.getTime());
  const constrainedMs = Math.min(baseMs, deadlineMs);
  const nextReviewAt = new Date(now.getTime() + constrainedMs);
  return {
    ...base,
    scheduler: 'deadline-aware',
    baseScheduler,
    nextReviewAt: nextReviewAt.toISOString(),
    reason: constrainedMs < baseMs ? 'deadline-compression' : 'base-schedule'
  };
}

export const SCHEDULERS = Object.freeze({
  fsrs: fsrsSchedule,
  sm2: sm2Schedule,
  leitner: leitnerSchedule,
  'forgetting-curve': forgettingCurveSchedule,
  'deadline-aware': deadlineAwareSchedule
});

export function scheduleWith(strategy, input = {}) {
  const id = strategy ?? 'fsrs';
  const scheduler = SCHEDULERS[id];
  if (!scheduler) throw new Error('unsupported scheduler: ' + id);
  return scheduler(input);
}

export function explainSchedule(result) {
  return {
    scheduler: result.scheduler,
    reason: result.reason,
    nextReviewAt: result.nextReviewAt,
    algorithmFamily: result.algorithmFamily ?? result.scheduler,
    transparent: true,
    stateSummary: {
      stabilityDays: result.state?.stabilityDays ?? null,
      difficulty: result.state?.difficulty ?? null,
      retrievability: result.state?.retrievability ?? null,
      intervalDays: result.state?.intervalDays ?? null,
      leitnerBox: result.state?.leitnerBox ?? null
    }
  };
}
