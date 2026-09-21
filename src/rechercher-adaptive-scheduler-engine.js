export function createScheduler({baseDays = 1, maxDays = 365} = {}) {
  if (baseDays <= 0 || maxDays < baseDays) throw new RangeError('Invalid scheduler bounds');
  return { baseDays, maxDays, cards: new Map() };
}

export function scheduleReview(engine, { cardId, correct, confidence = 0.5, now = new Date().toISOString() } = {}) {
  if (!cardId) throw new TypeError('cardId required');
  const previous = engine.cards.get(cardId) || { repetitions: 0, intervalDays: engine.baseDays, ease: 1 };
  const c = Math.max(0, Math.min(1, confidence));
  const success = Boolean(correct);
  const nextEase = Math.max(1, Math.min(3, previous.ease + (success ? 0.08 + c * 0.12 : -0.2)));
  const intervalDays = success
    ? Math.min(engine.maxDays, Math.max(engine.baseDays, Math.round(previous.intervalDays * nextEase)))
    : engine.baseDays;
  const next = new Date(new Date(now).getTime() + intervalDays * 86400000).toISOString();
  const state = { cardId, repetitions: success ? previous.repetitions + 1 : 0, intervalDays, ease: nextEase, confidence: c, lastResult: success, reviewedAt: now, nextReviewAt: next };
  engine.cards.set(cardId, state);
  return state;
}

export function dueCards(engine, at = new Date()) {
  const t = new Date(at).getTime();
  return [...engine.cards.values()].filter((card) => new Date(card.nextReviewAt).getTime() <= t);
}
