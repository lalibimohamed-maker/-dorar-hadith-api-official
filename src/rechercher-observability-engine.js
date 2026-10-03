export function createObservabilityEngine() {
  return { events: [], counters: new Map() };
}

export function emitEngineEvent(engine, { engineName, event, status = 'INFO', itemId = null, metrics = {} } = {}) {
  if (!engineName || !event) throw new TypeError('engineName and event are required');
  const entry = { at: new Date().toISOString(), engineName, event, status, itemId, metrics: structuredClone(metrics) };
  engine.events.push(entry);
  const key = `${engineName}:${event}:${status}`;
  engine.counters.set(key, (engine.counters.get(key) || 0) + 1);
  return entry;
}

export function summarizeObservability(engine) {
  return { events: engine.events.length, counters: Object.fromEntries(engine.counters) };
}
