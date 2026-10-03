export const QUEUE_CLASSES = Object.freeze({ GAP_DRIVEN: 100, VERIFICATION: 90, LEARNING: 80, TIME_SENSITIVE: 70, STANDARD_RESEARCH: 50, ARCHIVE: 20 });

export function createOrchestrationEngine({ capacity = 100, refillPerSecond = 10, concurrency = 8 } = {}) {
  if (capacity <= 0 || refillPerSecond <= 0 || concurrency <= 0) throw new RangeError('capacity, refillPerSecond and concurrency must be positive');
  return { capacity, tokens: capacity, refillPerSecond, concurrency, lastRefill: Date.now(), active: 0, queue: [], sequence: 0, metrics: { admitted: 0, deferred: 0, rejected: 0 } };
}

function refill(engine, now = Date.now()) {
  const elapsed = Math.max(0, (now - engine.lastRefill) / 1000);
  engine.tokens = Math.min(engine.capacity, engine.tokens + elapsed * engine.refillPerSecond);
  engine.lastRefill = now;
}

export function enqueueResearchTask(engine, task = {}) {
  if (!task.taskId || !task.kind) throw new TypeError('taskId and kind are required');
  const priority = Number.isFinite(task.priority) ? task.priority : (QUEUE_CLASSES[task.queueClass] || QUEUE_CLASSES.STANDARD_RESEARCH);
  const item = { ...structuredClone(task), priority, sequence: ++engine.sequence, estimatedCost: Math.max(1, task.estimatedCost || 1), status: 'QUEUED' };
  engine.queue.push(item);
  engine.queue.sort((a, b) => b.priority - a.priority || a.estimatedCost - b.estimatedCost || a.sequence - b.sequence);
  return structuredClone(item);
}

export function admitNextTask(engine, now = Date.now()) {
  refill(engine, now);
  if (engine.active >= engine.concurrency || !engine.queue.length) return null;
  const next = engine.queue[0];
  if (next.estimatedCost > engine.tokens) {
    engine.metrics.deferred++;
    return { status: 'BACKPRESSURE', retryAfterMs: Math.ceil(((next.estimatedCost - engine.tokens) / engine.refillPerSecond) * 1000), task: structuredClone(next) };
  }
  engine.queue.shift();
  engine.tokens -= next.estimatedCost;
  engine.active++;
  engine.metrics.admitted++;
  next.status = 'RUNNING';
  return structuredClone(next);
}

export function completeTask(engine, taskId) {
  if (engine.active > 0) engine.active--;
  return { taskId, status: 'COMPLETED', active: engine.active, queued: engine.queue.length };
}

export function orchestrationSnapshot(engine, now = Date.now()) {
  refill(engine, now);
  return { tokens: engine.tokens, active: engine.active, concurrency: engine.concurrency, queued: engine.queue.length, metrics: structuredClone(engine.metrics), priorityOrder: engine.queue.map(task => ({ taskId: task.taskId, priority: task.priority, queueClass: task.queueClass || null })) };
}
